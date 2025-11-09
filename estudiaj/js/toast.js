// toast.js
// Función reutilizable para mostrar un toast visual
window.toast = {
  showToast: function(msg) {
    let toast = document.getElementById('toastMsg');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toastMsg';
      toast.style.position = 'fixed';
      toast.style.bottom = '32px';
      toast.style.left = '50%';
      toast.style.transform = 'translateX(-50%)';
      toast.style.background = '#232b45';
      toast.style.color = '#e7ecff';
      toast.style.padding = '16px 32px';
      toast.style.borderRadius = '10px';
      toast.style.fontSize = '1.1rem';
      toast.style.boxShadow = '0 4px 16px rgba(0,0,0,0.18)';
      toast.style.zIndex = 9999;
      toast.style.opacity = 0;
      toast.style.transition = 'opacity 0.3s';
      toast.style.border = '2.5px solid #6ae0a7';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = 1;
    setTimeout(() => {
      toast.style.opacity = 0;
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 350); // Espera a que termine la transición
    }, 1800);
  }
};
