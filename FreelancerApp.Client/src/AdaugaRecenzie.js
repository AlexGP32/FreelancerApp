import Swal from 'sweetalert2'
import { GetAuthHeaders } from './TokenHeaders'

// Utility function to handle adding a review for a completed job.
// It uses SweetAlert2 to display a custom modal containing a form (rating + comment),
// and then submits the data to the backend.
// This function can be reused by both Clients and Freelancers.
export const handleAdaugaRecenzie = async (idAngajare, tipAutor) => {
    // Open a SweetAlert2 modal with custom HTML inputs
    const { value: formValues } = await Swal.fire({
        title: 'Scrie o recenzie',
        html:
            '<input id = "swal-nota" type="number" min= "1" max= "5" class="swal2-input" placeholder="Nota">' +
            '<textarea id="swal-comentariu" class="swal2-textarea" placeholder="Scrie un comentariu"></textarea>',
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Trimite Recenzie',
        cancelButtonText: 'Anulează',
        // Pre-confirm step to extract and validate the data from the custom HTML inputs
        preConfirm: () => {
            const nota = document.getElementById('swal-nota').value
            const comentariu = document.getElementById('swal-comentariu').value
            
            // Validate the rating is between 1 and 5
            if (!nota || nota < 1 || nota > 5) {
                Swal.showValidationMessage(
                    'te rog introdu o notă între 1 și 5.'
                )
                return false // Prevents modal from closing
            }
            // Return the validated values
            return { nota: parseInt(nota), comentariu: comentariu }
        },
    })

    // If the user confirmed the modal and validation passed
    if (formValues) {
        try {
            // Submit the review to the backend
            const res = await fetch('http://localhost:5129/api/Recenzie', {
                method: 'POST',
                headers: {
                    ...GetAuthHeaders(),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    idAngajare: idAngajare, // The job this review is associated with
                    tipAutor: tipAutor, // "Client" or "Freelancer"
                    nota: formValues.nota,
                    comentariu: formValues.comentariu,
                }),
            })
            const data = await res.json()
            
            if (res.ok) {
                Swal.fire('Succes', data.mesaj, 'success')
            } else {
                // e.g., Backend logic preventing duplicate reviews for the same job
                Swal.fire(
                    'Eroare',
                    data.eroare || 'A apărut o problemă.',
                    'error'
                )
            }
        } catch (err) {
            Swal.fire('Eroare', 'Nu ne-am putut conecta la server.', 'error')
        }
    }
}