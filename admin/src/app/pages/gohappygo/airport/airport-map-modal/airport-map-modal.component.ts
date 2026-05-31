import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { latLng, tileLayer, marker, divIcon, Layer, MapOptions, Map, LatLngBounds } from 'leaflet';
import { Airport } from '../airport.component';
import { AirportsService } from 'src/app/gohappygobackend/services';

@Component({
  selector: 'app-airport-map-modal',
  templateUrl: './airport-map-modal.component.html',
  styleUrls: ['./airport-map-modal.component.scss']
})
export class AirportMapModalComponent implements OnInit {
  airports: Airport[] = [];
  mapOptions: MapOptions;
  mapLayers: Layer[] = [];
  private map: Map;
  private loadedBounds: LatLngBounds | null = null;
  private isLoading = false;
  private allAirports: Airport[] = []; // Store all loaded airports

  constructor(
    public dialogRef: MatDialogRef<AirportMapModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { airports: Airport[] },
    private airportService: AirportsService
  ) {
    this.airports = data.airports;
  }

  ngOnInit(): void {
    this.initializeMap();
    this.loadInitialAirports();
  }

  private initializeMap(): void {
    this.mapOptions = {
      layers: [
        tileLayer(
          "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            maxZoom: 18,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          }
        )
      ],
      zoom: 2,
      center: latLng(20, 0)
    };
  }

  onMapReady(map: Map): void {
    this.map = map;
    
    // Load airports for current view
    this.loadAirportsForViewport();
    
    // Listen for map movement to load new airports
    this.map.on('moveend', () => {
      this.loadAirportsForViewport();
    });
  }

  private loadInitialAirports(): void {
    // Load a larger initial dataset with scheduled service filter
    this.airportService.airportControllerFindAll({
      page: 1,
      limit: 1000 as number,
      scheduledService: 'yes',
      orderBy: 'name:asc'
    }).subscribe({
      next: (response: any) => {
        if (response && response.items) {
          this.allAirports = response.items;
          this.createInitialMarkers();
        }
      },
      error: (error) => {
        console.error('Error loading initial airports:', error);
        // Fallback to table data
        this.allAirports = this.airports;
        this.createInitialMarkers();
      }
    });
  }

  private loadAirportsForViewport(): void {
    if (!this.map || this.isLoading) return;

    const bounds = this.map.getBounds();
    
    // Only load if bounds have changed significantly
    if (this.loadedBounds && this.loadedBounds.contains(bounds)) {
      return;
    }

    this.isLoading = true;
    
    // Filter airports within current viewport from loaded data
    const viewportAirports = this.filterAirportsByViewport(this.allAirports, bounds);
    this.updateMapMarkers(viewportAirports);
    this.loadedBounds = bounds;
    this.isLoading = false;
  }

  private filterAirportsByViewport(airports: Airport[], bounds: LatLngBounds): Airport[] {
    return airports.filter(airport => {
      if (!airport.latitudeDeg || !airport.longitudeDeg) return false;
      
      const lat = parseFloat(airport.latitudeDeg);
      const lng = parseFloat(airport.longitudeDeg);
      
      return bounds.contains([lat, lng]);
    });
  }

  private createInitialMarkers(): void {
    // Show initial airports from loaded data
    this.mapLayers = this.createMarkersFromAirports(this.allAirports);
  }

  private updateMapMarkers(airports: Airport[]): void {
    // Clear existing markers
    this.mapLayers.forEach(layer => {
      if (this.map) {
        this.map.removeLayer(layer);
      }
    });
    
    // Add new markers
    const newMarkers = this.createMarkersFromAirports(airports);
    this.mapLayers = newMarkers;
    
    newMarkers.forEach(marker => {
      if (this.map) {
        marker.addTo(this.map);
      }
    });
  }

  private createMarkersFromAirports(airports: Airport[]): Layer[] {
    return airports
      .filter(airport => {
        if (!airport.latitudeDeg || !airport.longitudeDeg) return false;
        
        const type = airport.type?.toLowerCase() || '';
        return type.includes('large') || type.includes('medium') || type.includes('small');
      })
      .map(airport => {
        const lat = parseFloat(airport.latitudeDeg);
        const lng = parseFloat(airport.longitudeDeg);
        
        if (isNaN(lat) || isNaN(lng)) {
          return null;
        }

        const airportIcon = this.getAirportIcon(airport);

        return marker([lat, lng], { icon: airportIcon })
          .bindPopup(`
            <div class="airport-popup">
              <h6><strong>${airport.name}</strong></h6>
              <p><strong>IATA:</strong> ${airport.iataCode || 'N/A'}</p>
              <p><strong>ICAO:</strong> ${airport.icaoCode || 'N/A'}</p>
              <p><strong>Location:</strong> ${airport.municipality}, ${airport.isoCountry}</p>
              <p><strong>Type:</strong> ${airport.type}</p>
              <p><strong>Service:</strong> ${airport.scheduledService === 'yes' ? 'Scheduled' : 'Non-Scheduled'}</p>
              <p><strong>Coordinates:</strong> ${lat.toFixed(4)}, ${lng.toFixed(4)}</p>
              ${airport.elevationFt ? `<p><strong>Elevation:</strong> ${airport.elevationFt} ft</p>` : ''}
              ${airport.homeLink ? `<p><strong>Website:</strong> <a href="${airport.homeLink}" target="_blank">Visit Website</a></p>` : ''}
              ${airport.wikipediaLink ? `<p><strong>Wikipedia:</strong> <a href="${airport.wikipediaLink}" target="_blank">View Article</a></p>` : ''}
            </div>
          `);
      })
      .filter(marker => marker !== null) as Layer[];
  }

  private getAirportIcon(airport: Airport): any {
    // Determine icon based on airport type
    let iconClass = 'mdi-airplane'; // default
    let size = 20; // default size

    if (airport.type) {
      const type = airport.type.toLowerCase();
      
      if (type.includes('heliport') || type.includes('helipad')) {
        iconClass = 'mdi-helicopter';
      } else if (type.includes('seaplane_base') || type.includes('water')) {
        iconClass = 'mdi-airplane-takeoff';
      } else if (type.includes('balloon') || type.includes('glider')) {
        iconClass = 'mdi-parachute';
      } else {
        iconClass = 'mdi-airport';
      }

      // Determine size based on airport type
      if (type.includes('large_airport')) {
        size = 18;
      } else if (type.includes('medium_airport')) {
        size = 16;
      } else if (type.includes('small_airport')) {
        size = 14;
      } else {
        size = 12; // very small or unknown
      }
    }

    // Determine color based on scheduled service
    const color = airport.scheduledService === 'yes' ? '#28a745' : '#000000';

    return divIcon({
      html: `<i class="mdi ${iconClass}" style="font-size: ${size}px; color: ${color}; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);"></i>`,
      className: 'custom-airport-icon',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2]
    });
  }

  onClose(): void {
    this.dialogRef.close();
  }
}
