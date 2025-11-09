// main.js - Menú principal Es Tu Dia Jugant
// Guardar última visita en localStorage
localStorage.setItem('stdj_lastVisit', new Date().toISOString());

// Botones del menú (sin funcionalidad de momento)
document.querySelectorAll('.menu-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    alert('Aquesta secció encara no està disponible!');
  });
});

document.getElementById('btnChoseOne').addEventListener('click', function() {
  window.location.href = 'pages/choosegame.html';
});
