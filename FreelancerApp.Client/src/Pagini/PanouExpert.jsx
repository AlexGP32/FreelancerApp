import { useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import '../CSS/Panou.css'
import { GetAuthHeaders } from '../TokenHeaders'

// Dashboard component for the "Expert Legal" role.
// This panel allows the legal expert to:
// 1. Validate (approve/reject) certificates uploaded by freelancers.
// 2. Resolve active disputes between clients and freelancers regarding project deliverables.
export default function PanouExpert({ utilizator }) {
    // --- State Management ---
    const [certificate, setCertificate] = useState([]) // List of pending certificates
    const [dispute, setDispute] = useState([]) // List of active disputes
    const [observatii, setObservatii] = useState({}) // Stores expert's comments for each certificate, keyed by certificate ID

    // Fetches all open disputes from the backend
    const fetchDispute = async () => {
        try {
            const res = await fetch(
                'http://localhost:5129/api/Dispute/deschise',
                {
                    headers: GetAuthHeaders(),
                }
            )
            if (res.ok) {
                const data = await res.json()
                setDispute(data)
            }
        } catch (error) {
            console.error('Eroare la încărcarea disputelor.', error)
        }
    }

    // Fetches all unvalidated certificates from the backend
    const incarcaCertificate = async () => {
        try {
            const res = await fetch(
                'http://localhost:5129/api/Certificat/nevalidate',
                {
                    headers: GetAuthHeaders(),
                }
            )
            if (res.ok) {
                const data = await res.json()
                setCertificate(data)
            }
        } catch (error) {
            console.error('Eroare la încărcarea certificatelor:', error)
        }
    }

    // Load initial data when the component mounts
    useEffect(() => {
        incarcaCertificate()
        fetchDispute()
    }, [])

    // --- Action Handlers ---

    // Submits the expert's decision (approve or reject) for a specific certificate
    const handleDecizie = async (idCertificat, decizie) => {
        const textDecizie = decizie ? 'aprobi' : 'respingi'
        
        // Confirm action with the user
        Swal.fire({
            title: `Ești sigur că vrei să ${textDecizie} acest certificat?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Da, confirm',
            cancelButtonText: 'Anulează',
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const raspuns = await fetch(
                        'http://localhost:5129/api/Certificat/decizie',
                        {
                            method: 'POST',
                            headers: {
                                ...GetAuthHeaders(),
                                'Content-Type': 'application/json',
                            },
                            // Payload includes the boolean decision and any written observations
                            body: JSON.stringify({
                                idCertificat: idCertificat,
                                aprobat: decizie,
                                observatii: observatii[idCertificat] || null,
                            }),
                        }
                    )
                    if (raspuns.ok) {
                        Swal.fire(
                            'Succes.',
                            `Certificatul a fost ${decizie ? 'aprobat' : 'respins'}.`,
                            'success'
                        )
                        // Remove the evaluated certificate from the UI list
                        setCertificate(
                            certificate.filter(
                                (cert) => cert.idCertificat !== idCertificat
                            )
                        )
                        // Clean up the observations state for this certificate
                        setObservatii((prev) => {
                            const copy = { ...prev }
                            delete copy[idCertificat]
                            return copy
                        })
                    } else {
                        const textEroare = await raspuns.text()
                        Swal.fire('Eroare', textEroare, 'error')
                    }
                } catch (error) {
                    console.error('Eroare cerere:', error)
                    Swal.fire('Eroare', 'Nu s-a putut conecta la server')
                }
            }
        })
    }

    // Handles the resolution of a dispute, deciding who receives the locked funds
    const handleRezolvaDisputa = async (idDisputa, castigator) => {
        const textConfirmare =
            castigator === 'Client'
                ? 'Banii vor fi rambursați clientului.'
                : 'Banii vor fi eliberați către freelancer.'
        
        // Confirm dispute resolution action
        const result = await Swal.fire({
            title: `Aprobă ideea ${castigator === 'Client' ? 'Clientului' : 'Freelancerului'}?`,
            text: textConfirmare,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Confirmă Decizia',
            cancelButtonText: 'Anulează',
        })
        if (result.isConfirmed) {
            Swal.fire({
                title: 'Se procesează decizia...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading(),
            })
            try {
                const res = await fetch(
                    `http://localhost:5129/api/Dispute/${idDisputa}/rezolva`,
                    {
                        method: 'POST',
                        headers: {
                            ...GetAuthHeaders(),
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ castigator }),
                    }
                )
                if (res.ok) {
                    const data = await res.json()
                    Swal.fire('Soluționat.', data.mesaj, 'success')
                    // Remove the resolved dispute from the UI
                    setDispute(
                        dispute.filter((d) => d.id_disputa !== idDisputa)
                    )
                } else {
                    const data = await res.json()
                    Swal.fire(
                        'Eroare',
                        data.eroare || 'A apărut o eroare',
                        'error'
                    )
                }
            } catch (err) {
                Swal.fire(
                    'Eroare',
                    'Eroare la conectarea către baza de date.',
                    'error'
                )
            }
        }
    }

    return (
        <div className="panou-client-container">
            
            {/* --- SECTION 1: CERTIFICATE VALIDATION --- */}
            <div className="card-proiect">
                <h3 className="panou-client-titlu"> Panoul de Validare </h3>
                <p>
                    Aici sunt certificatele încărcate de freelanceri care
                    necesită verificarea ta.
                </p>
                {certificate && certificate.length > 0 ? (
                    <ul className="lista-proiecte">
                        {certificate.map((cert) => (
                            <li
                                className="card-proiect"
                                key={cert.idCertificat}
                            >
                                <h4 className="card-titlu">
                                    {' '}
                                    Tip document: {cert.tip}{' '}
                                </h4>
                                <p>
                                    {' '}
                                    <strong> ID Freelancer: </strong>{' '}
                                    {cert.idFreelancer}{' '}
                                </p>
                                <p>
                                    {' '}
                                    <strong> Data Încărcării: </strong>{' '}
                                    {new Date(
                                        cert.dataIncarcarii
                                    ).toLocaleDateString()}{' '}
                                </p>
                                <a
                                    href={`http://localhost:5129/Uploads/${cert.fisier}`}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    Vezi Documentul atașat
                                </a>
                                
                                {/* Input for expert to leave feedback/observations on the certificate */}
                                <div className="camp-observatii">
                                    <label>
                                        <strong> Observații: </strong>
                                    </label>
                                    <textarea
                                        value={
                                            observatii[cert.idCertificat] || ''
                                        }
                                        onChange={(e) =>
                                            setObservatii((prev) => ({
                                                ...prev,
                                                [cert.idCertificat]:
                                                    e.target.value,
                                            }))
                                        }
                                        placeholder="diverse comentarii"
                                        rows={3}
                                    />
                                </div>
                                <div className="form-butoane">
                                    <button
                                        className="btn-trimite"
                                        onClick={() =>
                                            handleDecizie(
                                                cert.idCertificat,
                                                true // decizie = true (Aprobă)
                                            )
                                        }
                                    >
                                        Aprobă
                                    </button>
                                    <button
                                        className="btn-sterge-proiect"
                                        onClick={() =>
                                            handleDecizie(
                                                cert.idCertificat,
                                                false // decizie = false (Respinge)
                                            )
                                        }
                                    >
                                        Respinge
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="sectiune-goala">
                        <p>
                            {' '}
                            Nu există certificate noi care așteaptă
                            validarea.{' '}
                        </p>
                    </div>
                )}
            </div>

            {/* --- SECTION 2: DISPUTE RESOLUTION --- */}
            <div className="card-proiect">
                <h3 className="panou-client-titlu">
                    {' '}
                    Panoul de soluționare dispute{' '}
                </h3>
                <p>
                    Aici se analizează proiectele unde clientul a refuzat
                    lucrarea freelancerului.
                </p>
                {dispute && dispute.length > 0 ? (
                    <ul className="lista-proiecte">
                        {dispute.map((d) => (
                            <li className="card-proiect" key={d.id_disputa}>
                                <h4 className="card-titlu">
                                    {' '}
                                    Disputa #{d.id_disputa}{' '}
                                </h4>
                                <p>
                                    <strong> Data deschiderii: </strong>
                                    {new Date(
                                        d.data_deschiderii + 'Z'
                                    ).toLocaleDateString('ro-RO')}
                                </p>
                                <div>
                                    <strong>
                                        {' '}
                                        Mesajul inițial al freelancerului:{' '}
                                    </strong>
                                    <p> {d.sarcina}</p>
                                </div>
                                <div>
                                    <strong> Livrabilul predat: </strong>
                                    <a
                                        href={d.linkLivrabil}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {d.linkLivrabil}
                                    </a>
                                </div>
                                <div>
                                    <strong>
                                        {' '}
                                        Motivul clientului pentru refuz:{' '}
                                    </strong>
                                    <p>{d.motiv}</p>
                                </div>
                                <div className="butoane-finalizat">
                                    <button
                                        className="btn-sterge-proiect"
                                        onClick={() =>
                                            handleRezolvaDisputa(
                                                d.id_disputa,
                                                'Client' // Resolves dispute in favor of the client (refund)
                                            )
                                        }
                                    >
                                        Rambursează clientul
                                    </button>
                                    <button
                                        className="btn-sterge-proiect"
                                        onClick={() =>
                                            handleRezolvaDisputa(
                                                d.id_disputa,
                                                'Freelancer' // Resolves dispute in favor of the freelancer (payout)
                                            )
                                        }
                                    >
                                        Plătește freelancerul
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="sectiune-goala">
                        <p>
                            {' '}
                            Nu exisă nicio dispută activă pe platformă în acest
                            moment.{' '}
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}