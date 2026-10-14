import { useEffect, useState } from 'react'
import Swal from 'sweetalert2'
import '../CSS/Panou.css'
import { GetAuthHeaders } from '../TokenHeaders'

export default function PanouExpert({ utilizator }) {
    const [certificate, setCertificate] = useState([]) 
    const [dispute, setDispute] = useState([]) 
    const [observatii, setObservatii] = useState({}) 

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

    useEffect(() => {
        incarcaCertificate()
        fetchDispute()
    }, [])

    const handleDecizie = async (idCertificat, decizie) => {
        const textDecizie = decizie ? 'aprobi' : 'respingi'
        
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
                        setCertificate(
                            certificate.filter(
                                (cert) => cert.idCertificat !== idCertificat
                            )
                        )
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

    const handleRezolvaDisputa = async (idDisputa, castigator) => {
    const textConfirmare =
        castigator === 'Client'
            ? 'Banii vor fi rambursați clientului.'
            : 'Banii vor fi eliberați către freelancer.'

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
                                                true
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
                                                false 
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
                                                'Client' 
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
                                                'Freelancer' 
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