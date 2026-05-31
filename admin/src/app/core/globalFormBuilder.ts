import { Injectable } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import ClassicEditor from '@ckeditor/ckeditor5-build-classic';

@Injectable({
  providedIn: 'root'
})
export class GlobalFormBuilder {
  constructor(private fb: FormBuilder) {}
  public Editor = ClassicEditor;


  createLoginForm() {
    return this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }


  staffForm(){
    return  this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^\+?[1-9]\d{1,14}$/)]],
      roleId: [null, Validators.required],
      isVerified: [false],
      isPhoneVerified: [false]
    });
  }
}