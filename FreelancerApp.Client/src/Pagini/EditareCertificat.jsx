import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'

// Page where a freelancer updates/edits an existing certificate
// so they can replace a previously uploaded document.
export default function EditareCertificat() {
    const navigate = useNavigate()
    const [utilizator, setUtilizator] = useState(null) // logged-in user, loaded from localStorage
    const [fisier, setFisier] = useState(null) // the newly selected File object
    const [tipCertificat, setTipCertificat] = useState('') // free-text certificate type

    // Route guard: only logged-in freelancers may see this page
    useEffect(() => {
        const dateSalvate = localStorage.getItem('utilizatorLogat')
        if (!dateSalvate) {
            // Not logged in -> go to login
            navigate('/autentificare')
        } else {
            const userParsed = JSON.parse(dateSalvate)
            if (userParsed.rol !== 'Freelancer') {
                // Logged in but wrong role -> back to dashboard
                navigate('/panou')
            }
            setUtilizator(userParsed)
        }
    }, [navigate])

    // Keep only the first selected file (the input doesn't allow multiple)
    const handleFileChange = (e) => {
        setFisier(e.target.files[0])
    }

    // Validate the inputs, then upload the updated certificate to the backend
    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!tipCertificat.trim()) {
            Swal.fire(
                'Atenție',
                'Te rog introdu tipul certificatului.',
                'warning'
            )
            return
        }
        if (!fisier) {
            Swal.fire('Atenție', 'Te rog încarcă noul fișier.', 'warning')
            return
        }

        // FormData is required to send a file (multipart/form-data).
        // The keys ('Tip', 'Fisier') must match the property names on the backend model.
        const formData = new FormData()
        formData.append('Tip', tipCertificat)
        formData.append('Fisier', fisier)

        try {
            // Using PUT since we are editing/updating an existing resource.
            // No Content-Type header on purpose: the browser sets it automatically
            // (with the multipart boundary) when the body is FormData.
            // The JWT token proves who is updating.
            const response = await fetch(
                'http://localhost:5129/api/Certificat/editeaza',
                {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem('token')}`,
                    },
                    body: formData,
                }
            )

            if (response.ok) {
                // Wait for the user to close the popup before redirecting
                await Swal.fire({
                    icon: 'success',
                    title: 'Actualizat.',
                    text: 'Noul certificat a fost salvat și trimis spre validare.',
                })
                navigate('/panou')
            } else {
                // The backend returns errors as JSON in the form { eroare: "..." }
                const errorData = await response.json()
                Swal.fire(
                    'Eroare',
                    'A apărut o problemă: ' + errorData.eroare,
                    'error'
                )
            }
        } catch (error) {
            // Network failure: server down or unreachable
            console.error('Eroare de conexiune:', error)
            Swal.fire(
                'Eroare',
                'Nu s-a putut conecta la serverul backend.',
                'error'
            )
        }
    }

    // Render nothing useful until the guard above has loaded the user
    if (!utilizator) {
        return <h2> Se Încarcă</h2>
    }

    return (
        <div>
            <h2> Editează Certificatul</h2>
            <p>
                {' '}
                Încarcă un document nou pentru a-l înlocui pe cel aflat în
                așteptare.{' '}
            </p>
            <form onSubmit={handleSubmit}>
                <strong> Tip Certificat: </strong>
                <input
                    type="text"
                    value={tipCertificat}
                    onChange={(e) => setTipCertificat(e.target.value)}
                />
                <strong> Încarcă noul fișier (PDF, JPG, PNG): </strong>
                {/* accept only filters the file picker; the backend must still validate the file type */}
                <input
                    type="file"
                    accept=".pdf, image/*"
                    onChange={handleFileChange}
                />
                <button type="submit">Actualizează Certificatul</button>
                {/* type="button" so it doesn't submit the form */}
                <button type="button" onClick={() => navigate('/panou')}>
                    Înapoi la panou
                </button>
            </form>
        </div>
    )
}