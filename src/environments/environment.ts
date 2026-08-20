/**
 * Entorno de desarrollo (Angular no usa un archivo .env).
 * Cambia apiUrl si el backend corre en otro host o puerto.
 */
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api/v1',
  firebase: {
    apiKey: 'AIzaSyDacT9cWo8gUL1WqOck1IGyGmNkqkLyJkQ',
    authDomain: 'preubaproyecto.firebaseapp.com',
    projectId: 'preubaproyecto',
    storageBucket: 'preubaproyecto.firebasestorage.app',
    messagingSenderId: '428580030811',
    appId: '1:428580030811:web:90f699b447af06f4ed727e',
    measurementId: 'G-KJTPWLS00S',
  },
};
