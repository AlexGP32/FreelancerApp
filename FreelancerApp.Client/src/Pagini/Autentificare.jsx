import { useState, useEffect } from 'react'
import Swal from 'sweetalert2'
import '../CSS/Inregistrare-Logare.css'
import { useNavigate } from 'react-router-dom'

const Alerta = (icon, title, text) => {
    return Swal.fire({
        icon: icon,
        title: title,
        text: text,
    })
}

export default function Autentificare() {
    const navigate = useNavigate()

    useEffect(() => {
        const utilizator = localStorage.getItem('utilizatorLogat')
        if (utilizator) {
            navigate('/panou')
        }
    }, [navigate])

    const [pas, setPas] = useState(1)
    const [rol, setRol] = useState('Client')
    const [identificator, setIdentificator] = useState('')
    const [parola, setParola] = useState('')

    const handleUrmatorul = async (e) => {
        e.preventDefault()
        if (!identificator.trim()) {
            Alerta(
                'warning',
                'Atenție',
                'Te rog să completezi câmpul de identificare.'
            )
            return
        }
        setPas(2)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!parola.trim()) {
            Alerta('warning', 'Atenție', 'Te rog să introduci parola.')
            return
        }
        try {
            const raspuns = await fetch(
                'http://localhost:5129/api/Utilizator/login',
                {
                    method: 'POST',
                    headers: {
                        'Content-type': 'application/json',
                    },
                    body: JSON.stringify({
                        identificator: identificator,
                        parola: parola,
                        rol: rol,
                    }),
                }
            )
            if (raspuns.ok) {
                const dateUtilizator = await raspuns.json()
                localStorage.setItem('token', dateUtilizator.token)
                localStorage.setItem(
                    'utilizatorLogat',
                    JSON.stringify(dateUtilizator)
                )
                await Alerta(
                    'success',
                    `Salut ${dateUtilizator.nume}!`,
                    `Te-ai logat cu succes ca ${dateUtilizator.rol}.`
                )
                navigate('/panou')
            } else {
                // Returns the error message as plain text (Ex: wrong password, account does not exist)
                const textEroare = await raspuns.text()
                Alerta('error', 'Eroare', textEroare)
            }
        } catch (error) {
            console.error(error)
            Alerta(
                'error',
                'Problemă Conexiune',
                'Nu s-a putut conecta la server.'
            )
        }
    }

    const getLabelIdentificator = () => {
        if (rol === 'Client') {
            return 'Nume, Email, CNP sau CUI:'
        }
        if (rol === 'Expert_Legal') {
            return 'Nume, Email sau Cod Legitimație:'
        }
        if (rol === 'Admin') {
            return 'Nume, Email sau Cod Admin:'
        }
        if (rol === 'Freelancer') {
            return 'Nume, Email:'
        }
    }

    const proceseazaFormular = (e) => {
        if (pas === 1) {
            handleUrmatorul(e)
        } else {
            handleSubmit(e)
        }
    }

    return (
        <div className="register-container">
            {/* noValidate disables the browser's built-in validation (tooltips); we will use exclusively Swal pop-ups. */}
            <form
                className="register-form"
                onSubmit={proceseazaFormular}
                noValidate
            >
                <h2>Autentificare</h2>

                {pas === 1 && (
                    <>
                        <label>
                            {' '}
                            Alege tipul de cont:
                            <select
                                value={rol}
                                onChange={(e) => setRol(e.target.value)}
                            >
                                <option value="Client"> Client</option>
                                <option value="Freelancer"> Freelancer </option>
                                <option value="Expert_Legal">
                                    {' '}
                                    Expert Legal
                                </option>
                                <option value="Admin"> Admin </option>
                            </select>
                        </label>

                        <label>
                            <span>
                                {getLabelIdentificator()}{' '}
                                <span className="required"> *</span>
                            </span>
                            <input
                                type="text"
                                value={identificator}
                                onChange={(e) =>
                                    setIdentificator(e.target.value)
                                }
                            />
                        </label>
                        <button type="submit"> Următorul </button>
                        <button
                            type="button"
                            onClick={() => navigate('/inregistrare')}
                        >
                            Înapoi
                        </button>
                    </>
                )}

                {pas === 2 && (
                    <>
                        <div className="logare-info">
                            Logare pentru: <br />
                            <strong> ({identificator})</strong> <br />
                            <small>({rol})</small>
                        </div>
                        <label>
                            <span>
                                {' '}
                                Parola: <span className="required"> * </span>
                            </span>
                            <input
                                type="password"
                                value={parola}
                                onChange={(e) => setParola(e.target.value)}
                                placeholder="******"
                            />
                        </label>
                        <div className="logare-butoane">
                            <button type="button" onClick={() => setPas(1)}>
                                Înapoi
                            </button>
                            <button type="submit">Autentificare</button>
                        </div>
                    </>
                )}
            </form>
        </div>
    )
}