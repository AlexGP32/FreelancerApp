import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

// Child components for role-specific dashboard views
import PanouClient from './PanouClient'
import PanouFreelancer from './PanouFreelancer'
import PanouExpert from './PanouExpert'
import PanouAdmin from './PanouAdmin'
import '../CSS/Panou.css'

// Main Dashboard component that acts as a wrapper.
// It checks authentication and renders the appropriate sub-dashboard 
// based on the logged-in user's role.
export default function Panou() {
    const navigate = useNavigate()
    const [utilizator, setUtilizator] = useState(null) // Holds the parsed user data from localStorage

    // Route guard: check if the user is authenticated on component mount
    useEffect(() => {
        const dateSalvate = localStorage.getItem('utilizatorLogat')
        if (!dateSalvate) {
            // If no user data is found, redirect to the login page
            navigate('/autentificare')
        } else {
            // If user data exists, parse it and store it in state
            const userParsed = JSON.parse(dateSalvate)
            setUtilizator(userParsed)
        }
    }, [navigate])

    // Clears the user's session data and redirects to login
    const handleLogout = () => {
        localStorage.removeItem('utilizatorLogat')
        localStorage.removeItem('token')
        navigate('/autentificare')
    }

    // Prevent rendering the dashboard structure until the user data is loaded
    if (!utilizator) {
        return <h2> Se încarcă datele... </h2>
    }

    return (
        <div className="panou-container">
            {/* Global dashboard header visible to all roles */}
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
                
                {/* Common actions */}
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

            {/* Conditionally render the specific dashboard content based on user role */}
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