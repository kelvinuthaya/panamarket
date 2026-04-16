const ProduitCard = ({ designation, gamme, stActuel, stMin }) => {
    return (
      <div style={{ border: "1px solid gray", padding: "8px", margin: "4px" }}>
        <strong>{designation}</strong>
        <p>Rayon : {gamme}</p>
        <p>Stock actuel : {stActuel}</p>
        <p>Stock minimum : {stMin}</p>
      </div>
    )
  }
  
  export default ProduitCard