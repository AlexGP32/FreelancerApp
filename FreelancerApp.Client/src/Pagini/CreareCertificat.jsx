import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'

export default function CreareCertificat() {
    const navigate = useNavigate()
    const [utilizator, setUtilizator] = useState(null) 
    const [tipCertificat, setTipCertificat] = useState('') 
    const [fisier, setFisier] = useState(null) 

    useEffect(() => {
        const dateSalvate = localStorage.getItem('utilizatorLogat')
        if (!dateSalvate) {
            navigate('/autentificare')
        } else {
            const userParsed = JSON.parse(dateSalvate)
            if (userParsed.rol !== 'Freelancer') {
                navigate('/panou')
            }
            setUtilizator(userParsed)
        }
    }, [navigate])

    const handleFileChange = (e) => {
        setFisier(e.target.files[0])
    }

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

        // It is essential to use a FormData object to send a file (multipart/form-data).
        // The keys ('Tip', 'Fisier') must be identical to the property names expected by the .NET Controller
        const formData = new FormData()
        formData.append('Tip', tipCertificat)
        formData.append('Fisier', fisier)

        try {
            // The Content-Type header was intentionally omitted. The browser will automatically generate it, including the Boundary parameter required for files.
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
                await Swal.fire({
                    icon: 'success',
                    title: 'Succes',
                    text: 'Certificatul a fost salvat cu succes în baza de date.',
                })
                navigate('/panou')
            } else {
                const errorData = await response.json()
                Swal.fire(
                    'Eroare',
                    'A apărut o problemă: ' + errorData.eroare,
                    'error'
                )
            }
        } catch (error) {
            console.error('Eroare de conexiune:', error)
            Swal.fire(
                'Eroare',
                'Nu s-a putut conecta la serverul backend.',
                'error'
            )
        }
    }

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
                    <input
                        type="file"
                        accept=".pdf, image/*"
                        onChange={handleFileChange}
                    />
                </label>
                <div>
                    <button type="submit">Trimite spre validare</button>
                    <button type="button" onClick={() => navigate('/panou')}>
                        Înapoi
                    </button>
                </div>
            </form>
        </div>
    )
}