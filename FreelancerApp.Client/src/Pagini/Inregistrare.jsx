import { useState, useEffect } from 'react'
import Swal from 'sweetalert2'
import '../CSS/Inregistrare-Logare.css'
import { useNavigate } from 'react-router-dom'

export default function Inregistrare() {
    const navigate = useNavigate()

    useEffect(() => {
        const utilizator = localStorage.getItem('utilizatorLogat')
        if (utilizator) {
            navigate('/panou')
        }
    }, [navigate])

    const [rol, setRol] = useState('Client')
    const [nume, setNume] = useState('')
    const [email, setEmail] = useState('')
    const [parola, setParola] = useState('')
    const [confirmaParola, setConfirmaParola] = useState('')
    const [telefon, setTelefon] = useState('')
    const [judet, setJudet] = useState('')
    const [oras, setOras] = useState('')
    const [strada, setStrada] = useState('')
    const [numar, setNumar] = useState('')

    const [cnpCui, setCnpCui] = useState('') 
    const [iban, setIban] = useState('') 
    const [profesie, setProfesie] = useState('') 
    const [departament, setDepartament] = useState('') 
    const [codLegitimatie, setCodLegitimatie] = useState('') 
    const [codAdmin, setCodAdmin] = useState('') 

    const valideazaFormular = () => {
        if (
            !judet ||
            !oras ||
            !strada ||
            !numar ||
            !email ||
            !parola ||
            !telefon
        ) {
            return 'Toate câmpurile trebuie să fie completate !'
        }

        if (nume.length < 3) {
            return 'Numele trebuie să conțină minim 3 caractere.'
        }
        const numeRegex = /^[a-zA-ZăâîșțĂÂÎȘȚ\s-]+$/
        if (!numeRegex.test(nume)) {
            return 'Nume invalid! Folosește doar litere.'
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            return "Email invalid ! Formatul adecvat este 'nume@domeniu.com'"
        }

        const parolaRegex = /^(?=.*[a-zA-Z])(?=.*\d).{6,}$/
        if (!parolaRegex.test(parola)) {
            return 'Parola trebuie să aibă un minim de 6 caractere, conținând cel puțin o literă și o cifră.'
        }
        if (parola !== confirmaParola) {
            return 'Parolele nu coincid'
        }

        const telefonRegex = /^07\d{8}$/
        if (!telefonRegex.test(telefon)) {
            return "Telefon invalid ! Trebuie sa inceapă cu prefixul '07' și să aibe lungimea de 10 cifre."
        }

        if (rol === 'Client') {
            const valoare = cnpCui.trim().toUpperCase()

            // CNP Validation Algorithm (Modulo 11)
            const validareCNP = (cnpText) => {
                if (cnpText.length !== 13 || !/^[1-9]\d{12}$/.test(cnpText)) {
                    return false
                }
                const coeficienti = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9]
                let suma = 0
                for (let i = 0; i < 12; i++) {
                    suma += parseInt(cnpText.charAt(i)) * coeficienti[i]
                }
                let rest = suma % 11
                let cifraControlCalculata = rest === 10 ? 1 : rest
                let cifraControlReala = parseInt(cnpText.charAt(12))
                return cifraControlCalculata === cifraControlReala
            }

                // CUI Validation Algorithm (Modulo 11)            
                const validareCUI = (cuiText) => {
                let curatat = cuiText.replace(/^RO/i, '')
                if (!/^\d{2,10}$/.test(curatat)) {
                    return false
                }
                const coeficientiCUI = [7, 5, 3, 2, 1, 7, 5, 3, 2]
                let cifraControlReala = parseInt(
                    curatat.charAt(curatat.length - 1)
                )
                let numarFaraControl = curatat.substring(0, curatat.length - 1)
                let suma = 0
                let j = coeficientiCUI.length - 1
                for (let i = numarFaraControl.length - 1; i >= 0; i--) {
                    suma +=
                        parseInt(numarFaraControl.charAt(i)) * coeficientiCUI[j]
                    j--
                }
                let rest = (suma * 10) % 11
                let cifraControlCalculata = rest === 10 ? 0 : rest
                return cifraControlCalculata === cifraControlReala
            }

            if (!validareCNP(valoare) && !validareCUI(valoare)) {
                return 'CUI-ul sau CNP-ul introdus este invalid (cifra de control nu corespunde).'
            }
        }

        if (rol === 'Freelancer') {
                // IBAN Validation Algorithm (Modulo 97)            
                const validareIBAN = (ibanText) => {
                let iban = ibanText.replace(/\s+/g, '').toUpperCase()
                if (!/^RO\d{2}[A-Z0-9]{20}$/.test(iban)) {
                    return false
                }
                let rearanjat = iban.substring(4) + iban.substring(0, 4)
                let numericIban = ''
                for (let i = 0; i < rearanjat.length; i++) {
                    let charCode = rearanjat.charCodeAt(i)
                    if (charCode >= 65 && charCode <= 90) {
                        numericIban += (charCode - 55).toString()
                    } else {
                        numericIban += rearanjat.charAt(i)
                    }
                }
                let rest = BigInt(numericIban) % 97n
                return rest === 1n
            }
            if (!validareIBAN(iban)) {
                return 'Codul IBAN introdus nu este valid matematic.'
            }
            const profesieRegex = /^[a-zA-ZăâîșțĂÂÎȘȚ\s-]+$/
            if (!profesieRegex.test(profesie)) {
                return 'Profesie invalidă. Folosește doar litere.'
            }
        }

        if (rol === 'ExpertLegal') {
            if (departament.trim().length < 3) {
                return 'Denumirea departamentului este prea scurtă.'
            }
            if (codLegitimatie.length < 4 || codLegitimatie.length > 15) {
                return 'Codul legitimației trebuie să aibă între 4 și 15 caractere.'
            }
            const codRegex = /^[a-zA-Z0-9-]+$/
            if (!codRegex.test(codLegitimatie)) {
                return 'Codul legitimației poate conține doar litere, cifre și cratimă. '
            }
        }

        return null 
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        
        const eroare = valideazaFormular()
        if (eroare) {
            Swal.fire({
                icon: 'error',
                title: 'Eroare',
                text: eroare,
                confirmButtonColor: 'red',
            })
            return
        }

        let dateUtilizator = {
            nume,
            email,
            parola,
            telefon,
            judet,
            oras,
            strada,
            numar,
        }
        let linkApi = ''

        if (rol === 'Client') {
            dateUtilizator = { ...dateUtilizator, cnpCui: cnpCui.toUpperCase() }
            linkApi = 'http://localhost:5129/api/Utilizator/inregistrare-client'
        } else if (rol === 'Freelancer') {
            dateUtilizator = {
                ...dateUtilizator,
                iban: iban.replace(/\s/g, '').toUpperCase(), 
                profesie,
            }
            linkApi =
                'http://localhost:5129/api/Utilizator/inregistrare-freelancer'
        } else if (rol === 'ExpertLegal') {
            dateUtilizator = {
                ...dateUtilizator,
                departament,
                codLegitimatie: codLegitimatie.toUpperCase(),
            }
            linkApi = 'http://localhost:5129/api/Utilizator/inregistrare-expert'
        } else if (rol === 'Admin') {
            dateUtilizator = { ...dateUtilizator, codAdmin }
            linkApi = 'http://localhost:5129/api/Utilizator/inregistrare-admin'
        }

        try {
            const raspuns = await fetch(linkApi, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(dateUtilizator),
            })
            
            if (raspuns.ok) {
                await Swal.fire({
                    icon: 'success',
                    title: 'Succes!',
                    text: 'Înregistrare realizată cu succes!',
                    confirmButtonColor: 'green',
                })
                navigate('/autentificare')
            } else {
                // The error (e.g., email already exists) comes as plain text from our API, not as JSON.                 
                const textEroare = await raspuns.text()
                Swal.fire({
                    icon: 'error',
                    title: 'Eroare Server',
                    text: textEroare,
                    confirmButtonColor: 'red',
                })
            }
        } catch (err) {
            console.error(err)
            Swal.fire({
                icon: 'warning',
                title: 'Problemă Conexiune',
                text: 'Nu s-a putut conecta la server.',
            })
        }
    }

    return (
        <div className="register-container">
            {/* noValidate disables the browser's built-in validation (tooltips); we will use only Swal pop-ups */}
            <form className="register-form" onSubmit={handleSubmit} noValidate>
                <h2> Creare cont nou</h2>
                
                <label className="role-label">
                    Alege tipul de cont.
                    <select
                        className="role-selector"
                        value={rol}
                        onChange={(e) => setRol(e.target.value)}
                    >
                        <option value="Client"> Client </option>
                        <option value="Freelancer"> Freelancer </option>
                        <option value="ExpertLegal"> Expert Legal </option>
                        <option value="Admin"> Admin </option>
                    </select>
                </label>

                <label>
                    <span>
                        Județ: <span className="required"> * </span>
                    </span>
                    <input
                        type="text"
                        value={judet}
                        onChange={(e) => setJudet(e.target.value)}
                        placeholder="Introduceți județul"
                    />
                </label>
                <label>
                    {' '}
                    <span>
                        Oraș: <span className="required"> * </span>
                    </span>
                    <input
                        type="text"
                        value={oras}
                        onChange={(e) => setOras(e.target.value)}
                        placeholder="Introduceți orașul"
                    />
                </label>

                <label>
                    <span>
                        Stradă : <span className="required"> * </span>
                    </span>
                    <input
                        type="text"
                        value={strada}
                        onChange={(e) => setStrada(e.target.value)}
                        placeholder="Introduceți strada"
                    />
                </label>
                <label>
                    {' '}
                    <span>
                        Număr: <span className="required"> * </span>
                    </span>
                    <input
                        type="text"
                        value={numar}
                        onChange={(e) => setNumar(e.target.value)}
                        placeholder="Introduceți numărul"
                    />
                </label>
                <label>
                    <span>
                        {' '}
                        Nume: <span className="required"> * </span>
                    </span>
                    <input
                        type="text"
                        value={nume}
                        onChange={(e) => setNume(e.target.value)}
                        placeholder="Popescu"
                    />
                </label>
                <label>
                    <span>
                        {' '}
                        Email: <span className="required"> * </span>
                    </span>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="exemplu@email.com"
                    />
                </label>
                <label>
                    <span>
                        Parola: <span className="required"> * </span>
                    </span>
                    <input
                        type="password"
                        value={parola}
                        onChange={(e) => setParola(e.target.value)}
                        placeholder="parola123"
                    />
                </label>
                <label>
                    <span>
                        Confirmă Parola: <span className="required"> * </span>
                    </span>
                    <input
                        type="password"
                        value={confirmaParola}
                        onChange={(e) => setConfirmaParola(e.target.value)}
                        placeholder="parola123"
                    />
                </label>
                <label>
                    <span>
                        Telefon: <span className="required"> * </span>
                    </span>
                    <input
                        type="tel"
                        value={telefon}
                        onChange={(e) => setTelefon(e.target.value)}
                        placeholder="0712345678"
                    />
                </label>

                {rol === 'Client' && (
                    <label>
                        <span>
                            CNP/CUI <span className="required"> * </span>
                            <span
                                className="info-icon"
                                title="Codul unic de înregistrare pentru firme sau pentru persoane fizice."
                            >
                                {' '}
                                ⓘ{' '}
                            </span>
                        </span>
                        <input
                            type="text"
                            value={cnpCui}
                            onChange={(e) => setCnpCui(e.target.value)}
                            placeholder="2990219469000 (CNP)/14399840 (CUI)"
                        />
                    </label>
                )}

                {rol === 'Freelancer' && (
                    <>
                        <label>
                            <span>
                                Profesie : <span className="required"> * </span>
                            </span>
                            <input
                                type="text"
                                value={profesie}
                                onChange={(e) => setProfesie(e.target.value)}
                                placeholder="Ex: Programator Web, Designer..."
                            />
                        </label>
                        <label>
                            <span>
                                IBAN : <span className="required"> * </span>
                                <span
                                    className="info-icon"
                                    title="Contul bancar unde vei primi plățile pentru proiectele finalizate."
                                >
                                    {' '}
                                    ⓘ{' '}
                                </span>
                            </span>
                            <input
                                type="text"
                                value={iban}
                                onChange={(e) => setIban(e.target.value)}
                                placeholder="RO49AAAA1B31007593840000"
                            />
                        </label>
                    </>
                )}

                {rol === 'ExpertLegal' && (
                    <>
                        <label>
                            <span>
                                Departament:{' '}
                                <span className="required"> * </span>
                            </span>
                            <input
                                type="text"
                                value={departament}
                                onChange={(e) => setDepartament(e.target.value)}
                                placeholder="LEG-1234"
                            />
                        </label>
                        <label>
                            <span>
                                Cod Legitimație:{' '}
                                <span className="required"> * </span>
                            </span>
                            <input
                                type="text"
                                value={codLegitimatie}
                                onChange={(e) =>
                                    setCodLegitimatie(e.target.value)
                                }
                                placeholder="B-12345"
                            />
                        </label>
                    </>
                )}

                {rol === 'Admin' && (
                    <label>
                        <span>
                            Cod Admin: <span className="required"> * </span>
                            <span
                                className="info-icon"
                                title="Codul unic de securitate care permite crearea unui cont cu drepturi depline de Administrator."
                            >
                                {' '}
                                ⓘ{' '}
                            </span>
                        </span>
                        <input
                            type="password"
                            value={codAdmin}
                            onChange={(e) => setCodAdmin(e.target.value)}
                            placeholder="Introdu codul adminului"
                        />
                    </label>
                )}
                <button type="submit"> Înregistrare </button>
                <p>
                    {' '}
                    Ai deja cont ?
                    <span
                        className="link-autentificare"
                        onClick={() => navigate('/autentificare')}
                    >
                        Autentifică-te
                    </span>
                </p>
            </form>
        </div>
    )
}