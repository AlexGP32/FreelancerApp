import { useState, useEffect } from 'react'
import Swal from 'sweetalert2'
import '../CSS/Inregistrare-Logare.css'
import { useNavigate } from 'react-router-dom'

// Small helper to show a SweetAlert2 popup (returns a promise, so callers can await it)
const Alerta = (icon, title, text) => {
    return Swal.fire({
        icon: icon,
        title: title,
        text: text,
    })
}

// Two-step login form:
//   step 1 -> choose account type and enter the identifier (name / email / CNP / ...)
//   step 2 -> enter the password and submit to the API
export default function Autentificare() {
    const navigate = useNavigate()

    // If the user is already logged in, skip the login page and go to the dashboard
    useEffect(() => {
        const utilizator = localStorage.getItem('utilizatorLogat')
        if (utilizator) {
            navigate('/panou')
        }
    }, [navigate])

    const [pas, setPas] = useState(1) // current step: 1 or 2
    const [rol, setRol] = useState('Client') // selected account type
    const [identificator, setIdentificator] = useState('')
    const [parola, setParola] = useState('')

    // Step 1 -> step 2: only checks that the identifier is not empty.
    // The real validation (does the user exist?) happens on the server at submit.
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

    // Step 2: send credentials to the backend and store the session on success
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
                // Token is stored separately so API calls can read it easily;
                // the full user object is kept for displaying name/role in the UI
                localStorage.setItem('token', dateUtilizator.token)
                localStorage.setItem(
                    'utilizatorLogat',
                    JSON.stringify(dateUtilizator)
                )
                // Wait for the user to close the popup before redirecting
                await Alerta(
                    'success',
                    `Salut ${dateUtilizator.nume}!`,
                    `Te-ai logat cu succes ca ${dateUtilizator.rol}.`
                )
                navigate('/panou')
            } else {
                // The server returns the error message as plain text (e.g. wrong password)
                const textEroare = await raspuns.text()
                Alerta('error', 'Eroare', textEroare)
            }
        } catch (error) {
            // Network failure: server down or unreachable
            console.error(error)
            Alerta(
                'error',
                'Problemă Conexiune',
                'Nu s-a putut conecta la server.'
            )
        }
    }

    // Each account type can log in with a different set of identifiers,
    // so the label changes with the selected role
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

    // One onSubmit handler for both steps: Enter key and the submit button
    // run the logic of whichever step is currently shown
    const proceseazaFormular = (e) => {
        if (pas === 1) {
            handleUrmatorul(e)
        } else {
            handleSubmit(e)
        }
    }

    return (
        <div className="register-container">
            {/* noValidate disables the browser's built-in validation;
                we validate manually and show SweetAlert popups instead */}
            <form
                className="register-form"
                onSubmit={proceseazaFormular}
                noValidate
            >
                <h2>Autentificare</h2>

                {/* ===== Step 1: account type + identifier ===== */}
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
                        {/* type="button" so it doesn't submit the form; goes to the register page */}
                        <button
                            type="button"
                            onClick={() => navigate('/inregistrare')}
                        >
                            Înapoi
                        </button>
                    </>
                )}

                {/* ===== Step 2: password ===== */}
                {pas === 2 && (
                    <>
                        {/* Recap of what was entered in step 1 */}
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
                            {/* Back to step 1 (does not leave the page) */}
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