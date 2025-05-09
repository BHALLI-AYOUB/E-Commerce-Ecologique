import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { PaginationComponent } from '../pagination/pagination.component';
import { ApiService } from '../service/api.service';
import { Router } from '@angular/router';

// Interface pour typer correctement la réponse de l'API
interface ProfileResponse {
  [key: string]: any;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, PaginationComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent implements OnInit {
  userInfo: any = null;
  error: any = null;
  isLoading = true;
  currentPage: number = 1;
  itemsPerPage: number = 5;

  constructor(private apiService: ApiService, private router: Router) { }

  ngOnInit(): void {
    this.fetchUserInfo();
  }

  fetchUserInfo(): void {
    this.isLoading = true;
    this.apiService.getLoggedInUserInfo().subscribe({
      next: (response: ProfileResponse) => {
        // Utilisation de la notation par crochets pour éviter l'erreur TS4111
        this.userInfo = response['user'];
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error fetching user info:', error);
        this.error = error?.error?.message || "Impossible de récupérer les informations de l'utilisateur";
        this.isLoading = false;
      }
    });
  }

  handleAddressClick(): void {
    // Détermine si l'utilisateur a déjà une adresse pour choisir la bonne route
    const urlPathToNavigateTo = this.userInfo?.address ? '/edit-address' : '/add-address';
    this.router.navigate([urlPathToNavigateTo]);
  }

  onPageChange(page: number): void {
    this.currentPage = page;
  }

  // Getter pour obtenir les commandes paginées
  get paginatedOrders(): any[] {
    if (!this.userInfo?.orderItemList) return [];

    return this.userInfo.orderItemList.slice(
      (this.currentPage - 1) * this.itemsPerPage,
      this.currentPage * this.itemsPerPage
    );
  }

  // Getter pour calculer le nombre total de pages pour les commandes
  get totalPages(): number {
    return Math.ceil((this.userInfo?.orderItemList?.length || 0) / this.itemsPerPage);
  }

  // Ajout d'une méthode pour recharger les informations de l'utilisateur
  reloadUserInfo(): void {
    this.fetchUserInfo();
  }
}