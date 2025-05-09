import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../service/api.service';
import { Router } from '@angular/router';

// Interface pour typer correctement la réponse de l'API
interface UserResponse {
  [key: string]: any;
}

@Component({
  selector: 'app-address',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './address.component.html',
  styleUrl: './address.component.css'
})
export class AddressComponent implements OnInit {
  
  addressForm: FormGroup;
  error: any = null;
  isEditMode: boolean;
  isLoading = false;
  
  constructor(private apiService: ApiService, private fb: FormBuilder, private router: Router) {
    this.isEditMode = this.router.url.includes('edit-address');
    this.addressForm = this.fb.group({});
  }
  
  ngOnInit(): void {
    this.addressForm = this.fb.group({
      street: ['', Validators.required],
      city: ['', Validators.required],
      state: ['', Validators.required],
      zipCode: ['', Validators.pattern('^[0-9]*$')],
      country: ['', Validators.required]
    });
    
    if (this.isEditMode) {
      this.fetchUserAddressInfo();
    }
  }
  
  fetchUserAddressInfo(): void {
    this.isLoading = true;
    this.apiService.getLoggedInUserInfo().subscribe({
      next: (response: UserResponse) => {
        this.isLoading = false;
        // Utilisation de la notation par crochets pour éviter l'erreur TS4111
        if (response['user'] && response['user'].address) {
          this.addressForm.patchValue(response['user'].address);
        }
      },
      error: (error) => {
        this.isLoading = false;
        console.error('Error fetching user address:', error);
        this.showError(error?.error?.message || "Impossible d'obtenir l'adresse de l'utilisateur");
      }
    });
  }
  
  handleSubmit(): void {
    if (this.addressForm.invalid) {
      this.showError("Veuillez remplir tous les champs requis");
      // Marquer tous les champs comme 'touchés' pour afficher les erreurs de validation
      this.markFormGroupTouched(this.addressForm);
      return;
    }
    
    this.isLoading = true;
    this.apiService.saveAddress(this.addressForm.value).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.router.navigate(['/profile']);
      },
      error: (error) => {
        this.isLoading = false;
        console.error('Error saving address:', error);
        this.showError(error?.error?.message || "Impossible d'enregistrer l'adresse");
      }
    });
  }
  
  showError(message: string): void {
    this.error = message;
    setTimeout(() => {
      this.error = null;
    }, 3000);
  }
  
  // Utilitaire pour marquer tous les champs comme touchés et montrer les erreurs de validation
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if ((control as any).controls) {
        this.markFormGroupTouched(control as FormGroup);
      }
    });
  }
}