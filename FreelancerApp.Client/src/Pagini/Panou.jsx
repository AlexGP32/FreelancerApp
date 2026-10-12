import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import PanouClient from './PanouClient'
import PanouFreelancer from './PanouFreelancer'
import PanouExpert from './PanouExpert'
import PanouAdmin from './PanouAdmin'
import '../CSS/Panou.css'

export default function Panou() {
    const navigate = useNavigate()
    const [utilizator, setUtilizator] = useState(null) 

    useEffect(() => {
        const dateSalvate = localStorage.getItem('utilizatorLogat')
        if (!dateSalvate) {
            navigate('/autentificare')
        } else {
            const userParsed = JSON.parse(dateSalvate)
            setUtilizator(userParsed)
        }
    }, [navigate])

    const handleLogout = () => {
        localStorage.removeItem('utilizatorLogat')
        localStorage.removeItem('token')
        navigate('/autentificare')
    }

    if (!utilizator) {
        return <h2> Se încarcă datele... </h2>
    }

    return (
        <div className="panou-container">
            <header className="panou-header">
                <h2 className="panou-header-titlu">
                    {' '}
                    Salut, {utilizator.nume}!
                </h2>
                <p className="panou-header-rol">
                    {' '}
                    Ești autentificat cu rolul de:{' '}
                    <strong> {utilizator.rol}</strong>
                </p>
                
                <button onClick={handleLogout} className="btn-logout">
                    {' '}
                    Deconectare{' '}
                </button>
                <button
                    className="btn-setari"
                    onClick={() => navigate('/setaricont')}
                >
                    {' '}
                    Actualizează date{' '}
                </button>
                <button
                    className="btn-schimbare-rol"
                    onClick={() => navigate('/schimbarerol')}
                >
                    Schimbare Rol{' '}
                </button>
            </header>

            <main className="panou-content">
                {utilizator.rol === 'Client' && (
                    <PanouClient utilizator={utilizator} />
                )}
                {utilizator.rol === 'Freelancer' && (
                    <PanouFreelancer utilizator={utilizator} />
                )}
                {utilizator.rol === 'Expert_Legal' && (
                    <PanouExpert utilizator={utilizator} />
                )}
                {utilizator.rol === 'Admin' && (
                    <PanouAdmin utilizator={utilizator} />
                )}
            </main>
        </div>
    )
}