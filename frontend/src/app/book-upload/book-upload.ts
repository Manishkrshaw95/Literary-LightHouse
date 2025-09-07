import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-book-upload',
  standalone: true,
  imports: [ReactiveFormsModule , CommonModule],
  templateUrl: './book-upload.html',
  styleUrls: ['./book-upload.scss']
})
export class BookUploadComponent implements OnInit {
  bookForm: FormGroup;
  categories: { id: number; name: string }[] = [];
  uploading = false;
  uploadError = '';
  uploadSuccess = false;
  selectedFile: File | null = null;

  constructor(private fb: FormBuilder) {
    this.bookForm = this.fb.group({
      name: ['', Validators.required],
      title: ['', Validators.required],
      price: ['', [Validators.required, Validators.min(0)]],
      categories: [[], Validators.required],
      image: [null, Validators.required]
    });
  }

  ngOnInit() {
    fetch('http://localhost:8080/api/categories')
      .then(res => res.json())
      .then(data => this.categories = data)
      .catch(() => this.categories = []);
  }

  onFileChange(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      this.bookForm.patchValue({ image: file });
    }
  }

  onSubmit() {
    if (this.bookForm.invalid || !this.selectedFile) return;
    this.uploading = true;
    this.uploadError = '';
    this.uploadSuccess = false;

    const formData = new FormData();
    formData.append('name', this.bookForm.value.name);
    formData.append('title', this.bookForm.value.title);
    formData.append('price', this.bookForm.value.price);
    for (const catId of this.bookForm.value.categories) {
      formData.append('categories', catId);
    }
    formData.append('image', this.selectedFile);

    fetch('http://localhost:8080/api/books', {
      method: 'POST',
      body: formData
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to upload book');
        return res.json();
      })
      .then(() => {
        this.uploadSuccess = true;
        this.bookForm.reset();
        this.selectedFile = null;
      })
      .catch(err => {
        this.uploadError = err.message;
      })
      .finally(() => {
        this.uploading = false;
      });
  }
}
