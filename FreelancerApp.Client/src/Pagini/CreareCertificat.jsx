import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'

// Page where a freelancer uploads a certificate (diploma, proof of expertise)
// so the account can be validated before applying to jobs.
export default function CreareCertificat() {
    const navigate = useNavigate()
    const [utilizator, setUtilizator] = useState(null) // logged-in user, loaded from localStorage
    const [tipCertificat, setTipCertificat] = useState('') // free-text certificate type
    const [fisier, setFisier] = useState(null) // the selected File object

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

    // Validate the inputs, then upload the certificate to the backend
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
            Swal.fire('Atenție', 'Te rog încarcă un fișier.', 'warning')
            return
        }

        // FormData is required to send a file (multipart/form-data).
        // The keys ('Tip', 'Fisier') must match the property names on the backend model.
        const formData = new FormData()
        formData.append('Tip', tipCertificat)
        formData.append('Fisier', fisier)

        try {
            // No Content-Type header on purpose: the browser sets it automatically
            // (with the multipart boundary) when the body is FormData.
            // The JWT token proves who is uploading.
            const response = await fetch(
                'http://localhost:5129/api/Certificat/adauga',
                {
                    method: 'POST',
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
                    title: 'Succes',
                    text: 'Certificatul a fost salvat cu succes în baza de date.',
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
        return <h2> Se încarcă...</h2>
    }

    return (
        <div>
            <h2> Adăugare Certificat </h2>
            <p>
                {' '}
                Pentru a putea aplica la joburi, trebuie să îți validezi contul
                încărcând documentele necesare.
            </p>
            <form onSubmit={handleSubmit}>
                <label>
                    <strong> Tip Certificat:</strong>
                    <input
                        type="text"
                        value={tipCertificat}
                        onChange={(e) => setTipCertificat(e.target.value)}
                        placeholder="Diplomă Licență, Certificat care atestă expertiza..."
                    />
                </label>
                <label>
                    <strong> Încarcă Fișier (PDF, JPG, PNG):</strong>
                    {/* accept only filters the file picker; the backend must still validate the file type */}
                    <input
                        type="file"
                        accept=".pdf, image/*"
                        onChange={handleFileChange}
                    />
                </label>
                <div>
                    <button type="submit">Trimite spre validare</button>
                    {/* type="button" so it doesn't submit the form */}
                    <button type="button" onClick={() => navigate('/panou')}>
                        Înapoi
                    </button>
                </div>
            </form>
        </div>
    )
}