import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'

export default function EditareCertificat() {
    const navigate = useNavigate()
    const [utilizator, setUtilizator] = useState(null) 
    const [fisier, setFisier] = useState(null) 
    const [tipCertificat, setTipCertificat] = useState('') 

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
            Swal.fire('Atenție', 'Te rog încarcă noul fișier.', 'warning')
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
                await Swal.fire({
                    icon: 'success',
                    title: 'Actualizat.',
                    text: 'Noul certificat a fost salvat și trimis spre validare.',
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
                <input
                    type="file"
                    accept=".pdf, image/*"
                    onChange={handleFileChange}
                />
                <button type="submit">Actualizează Certificatul</button>
                <button type="button" onClick={() => navigate('/panou')}>
                    Înapoi la panou
                </button>
            </form>
        </div>
    )
}