import {useState, useEffect} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../CSS/Panou.css'
import { GetAuthHeaders } from '../TokenHeaders';

export default function ProfilFreelancer(){
    const{idFreelancer} = useParams();
    const navigate = useNavigate();
    const [recenzii, setRecenzii] = useState([]);
    const [medie, setMedie] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchRecenzii();
    }, [idFreelancer]);

    const fetchRecenzii = async() => {
        try{
            const res = await fetch (`http://localhost:5129/api/Recenzie/freelancer/${idFreelancer}`, {
                headers: GetAuthHeaders()
            });
            if (res.ok){
                const data = await res.json();
                setRecenzii(data.recenzii);
                setMedie(data.medie);
            }
        } catch (err){
            console.error("Eroare:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const Stele = (nota) => {
        return [1,2,3,4,5].map(s => (
            <span key={s}>{s <= nota ? "★" : "☆"}</span>
        ));
    };

    if (isLoading){
        return <p> Se încarcă...</p>;
    }

    return (
        <div className="panou-client-container"> 
            <button className="btn-inapoi" onClick={() => navigate(-1)}> Înapoi</button>
            <h2 className="panou-client-titlu"> Profil Freelancer </h2>
            
            <div className="card-proiect">
                <p className="panou-sectiune-titlu">
                    {Stele(Math.round(medie))} {medie > 0 ? `${medie} / 5` : "Nu există recenzii"}
                    ({recenzii.length} {recenzii.length === 1 ? "recenzie" : "recenzii"})
                </p>
            </div>

            {recenzii.length === 0 ? (
                <div className="sectiune-goala">
                    <p> Acest freelancer nu are recenzii încă.</p>
                </div>
            ) : (
                <ul className="lista-proiecte">
                    {recenzii.map((r) => (
                        <li className="card-proiect" key={r.idRecenzie}>
                            <div className="card-titlu">{Stele(r.nota)}</div>
                            <p>{r.comentariu || "Fără comentariu."}</p>
                            <small className="data-recenzie">{new Date(r.data).toLocaleDateString('ro-RO')}</small>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}