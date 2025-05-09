import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pagination.component.html',
  styleUrl: './pagination.component.css'
})
export class PaginationComponent {
  @Input() currentPage: number = 1;
  @Input() totalPages: number = 1;
  @Output() pageChange = new EventEmitter<number>();

  /**
   * Returns a limited range of page numbers to display
   * Shows max 5 pages, centered around the current page when possible
   */
  get pages(): number[] {
    const visiblePages = 5; // Number of visible page links
    const pages: number[] = [];
    
    // If few enough pages, show all
    if (this.totalPages <= visiblePages) {
      return this.pageNumbers;
    }
    
    // Calculate start and end pages for display
    let startPage = Math.max(1, this.currentPage - Math.floor(visiblePages / 2));
    let endPage = Math.min(this.totalPages, startPage + visiblePages - 1);
    
    // Adjust start page if end page is maximized
    if (endPage === this.totalPages) {
      startPage = Math.max(1, endPage - visiblePages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  }
  
  /**
   * Returns full array of all page numbers (1...totalPages)
   */
  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  /**
   * Emit page change event if the page is valid
   */
  changePage(page: number): void {
    if (page !== this.currentPage && page >= 1 && page <= this.totalPages) {
      this.pageChange.emit(page);
    }
  }

  /**
   * Go to first page
   */
  firstPage(): void {
    if (this.currentPage !== 1) {
      this.changePage(1);
    }
  }

  /**
   * Go to previous page
   */
  previousPage(): void {
    if (this.currentPage > 1) {
      this.changePage(this.currentPage - 1);
    }
  }

  /**
   * Go to next page
   */
  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.changePage(this.currentPage + 1);
    }
  }

  /**
   * Go to last page
   */
  lastPage(): void {
    if (this.currentPage !== this.totalPages) {
      this.changePage(this.totalPages);
    }
  }

  /**
   * Check if a page is the active page
   */
  isCurrentPage(page: number): boolean {
    return this.currentPage === page;
  }
  
  /**
   * Check if previous navigation is disabled
   */
  isPreviousDisabled(): boolean {
    return this.currentPage <= 1;
  }
  
  /**
   * Check if next navigation is disabled
   */
  isNextDisabled(): boolean {
    return this.currentPage >= this.totalPages;
  }
}