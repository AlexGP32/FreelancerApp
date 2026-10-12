import {useState, useEffect} from 'react';
import {useParams, useNavigate } from 'react-router-dom';
import '../CSS/Panou.css';
import { GetAuthHeaders } from '../TokenHeaders';

export default function ProfilClient(){
    const{idClient} = useParams();
    const navigate = useNavigate();
    const [recenzii, setRecenzii] = useState([]);
    const [medie, setMedie] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchRecenzii();
    }, [idClient]);

    const fetchRecenzii = async() => {
        try{
            const res = await fetch (`http://localhost:5129/api/Recenzie/client/${idClient}`, {
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
        <div className="profil-container"> 
            <button className="btn-inapoi" onClick={() => navigate(-1)}> Înapoi</button>
            <h2 className="profil-titlu"> Profil Client </h2>
            
            <p> {Stele(Math.round(medie))} {medie > 0 ? `${medie} / 5` : "Nu există recenzii"}
                ({recenzii.length} {recenzii.length === 1 ? "recenzie" : "recenzii"})
            </p>
            
            {recenzii.length === 0 ? (
                <p> Acest client nu are recenzii încă.</p>
            ) : (
                recenzii.map((r) => (
                    <div key={r.idRecenzie}>
                        <div>{Stele(r.nota)}</div>
                        <p>{r.comentariu || "Fără comentariu."}</p>
                        <small>{new Date(r.data).toLocaleDateString('ro-RO')}</small>
                    </div>
                ))
            )}
        </div>
    );
}