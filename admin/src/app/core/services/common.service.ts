
import { Injectable } from "@angular/core";

import Swal from "sweetalert2";
import { Observable } from "rxjs";
import { FormGroup } from "@angular/forms";


@Injectable({
  providedIn: 'root'
})
export class CommonService {

constructor(){

  }

 

  resetForm(basicInfoForm: FormGroup<any>) {
  basicInfoForm.reset()
  }


  disableForm(basicInfoForm:FormGroup<any>) {
  basicInfoForm.disable()
}

enableForm(basicInfoForm:FormGroup<any>) {
  basicInfoForm.enable()
}



convertDateTimeToDate(rawDate:string):string{
const formattedDate = rawDate ? rawDate.split('T')[0] : null;
return formattedDate
}


truncateText(longText: string, desiredLength: number): string {
  if (!longText) {
    return '';
  }

  if (longText.length <= desiredLength) {
    return longText;
  }

  if (desiredLength <= 3) {
    return '...'.substring(0, desiredLength);
  }

  const shortenedText = longText.substring(0, desiredLength - 3) + '...';

  return shortenedText;
}



  
}