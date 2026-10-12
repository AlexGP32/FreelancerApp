import React, { useState, useEffect } from 'react'
import Swal from 'sweetalert2'
import { GetAuthHeaders } from '../TokenHeaders'

export default function ProiecteActive() {
    const [proiecte, setProiecte] = useState([])
    const [linkPredare, setLinkPredare] = useState({})
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        fetchProiecteActive()
    }, [])

    const fetchProiecteActive = async () => {
        setIsLoading(true)
        try {
            const res = await fetch(
                `http://localhost:5129/api/Angajari/freelancer/active`,
                {
                    headers: GetAuthHeaders(),
                }
            )
            if (res.ok) {
                const data = await res.json()
                const proiecteInDesfasurare = data.filter(
                    (p) =>
                        p.status !== 'Finalizat' && p.status !== 'In Evaluare'
                )
                setProiecte(proiecteInDesfasurare)
            } else {
                console.error('Nu s-au putut încarca proiectele.')
            }
        } catch (err) {
            console.error('Eroare la rețea:', err)
        } finally {
            setIsLoading(false)
        }
    }

    const handleLinkChange = (idAngajare, valoare) => {
        setLinkPredare({ ...linkPredare, [idAngajare]: valoare })
    }

    const handlePredareMunca = async (idAngajare) => {
        const linkTrimis = linkPredare[idAngajare]
        
        if (!linkTrimis || linkTrimis.trim() === '') {
            Swal.fire({
                icon: 'warning',
                title: 'Atenție',
                text: 'Te rog introdu un link valid către livrabilul tău',
            })
            return
        }
        
        const regexLink = /^(https?:\/\/)?([\w\-]+\.)+[a-z]{2,}(\/.*)?$/i
        if (!regexLink.test(linkTrimis.trim())) {
            Swal.fire({
                icon: 'error',
                title: 'Link invalid',
                text: 'Link-ul introdus nu este corect. Folosește un format valid (https://github.com)',
            })
            return
        }

        Swal.fire({
            title: 'Se predă lucrarea...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading(),
        })

        try {
            const res = await fetch(
                `http://localhost:5129/api/Angajari/${idAngajare}/predare`,
                {
                    method: 'POST',
                    headers: {
                        ...GetAuthHeaders(),
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ link: linkTrimis.trim() }),
                }
            )
            if (res.ok) {
                Swal.fire(
                    'Succes.',
                    'Lucrarea a fost predată. Așteptăm răspunsul clientului.',
                    'success'
                )
                setLinkPredare({ ...linkPredare, [idAngajare]: '' })
                fetchProiecteActive()
            } else {
                const data = await res.json()
                Swal.fire(
                    'Eroare',
                    data.eroare || 'A apărut o problemă la predare.',
                    'error'
                )
            }
        } catch (err) {
            Swal.fire('Eroare', 'Eroare de conexiune la server.', 'error')
        }
    }

    if (isLoading) {
        return <p> Se încarcă proiectele în desfășurare...</p>
    }

    return (
        <div>
            <div>
                <h4 className="panou-sectiune-titlu">
                    {' '}
                    Proiectele tale în desfășurare{' '}
                </h4>
                {proiecte.length === 0 ? (
                    <div className="sectiune-goala">
                        <p>
                            {' '}
                            Nu ai proiecte care necesită predare în acest
                            moment.
                        </p>
                    </div>
                ) : (
                    <div>
                        {proiecte.map((p) => (
                            <div key={p.idAngajare} className="card-evaluare">
                                <div>
                                    <h5 className="card-titlu"> {p.titlu} </h5>
                                    <span> [Plată blocată de client] </span>
                                </div>
                                <p> {p.descriere}</p>
                                <p>
                                    <strong> Angajat pe: </strong>
                                    {new Date(
                                        p.dataAngajarii
                                    ).toLocaleDateString('ro-RO')}
                                </p>
                                <div>
                                    <label className="form-label">
                                        Link (Ex: Google Drive, Github):
                                    </label>
                                    <br />
                                    <input
                                        className="form-input"
                                        type="text"
                                        placeholder="https://..."
                                        value={linkPredare[p.idAngajare] || ''}
                                        onChange={(e) =>
                                            handleLinkChange(
                                                p.idAngajare,
                                                e.target.value
                                            )
                                        }
                                    />
                                    <button
                                        className="btn-elibereaza"
                                        style={{ marginTop: '10px' }}
                                        onClick={() =>
                                            handlePredareMunca(p.idAngajare)
                                        }
                                    >
                                        Trimite Munca
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}