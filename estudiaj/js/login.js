// login.js
// Centraliza la lógica de comprobación de usuario con bcryptjs para reutilización

export const login = {
  
  /**
   * Comprueba si el usuario guardado en localStorage es válido.
   * Si no es válido, redirige a 401.html.
   * Utiliza checkUserPass para la validación.
   */
  async checkUserAuth() {
    const user_name = localStorage.getItem('stdj_user_name');
    const user_pass = localStorage.getItem('stdj_user_pass');
    if (!user_name || !user_pass) {
      window.location.href = '401.html';
      return;
    }
    try {
      const isValid = await login.checkUserPass(user_name, user_pass);
      if (isValid !== true) throw new Error(isValid);
    } catch (e) {
      window.location.href = '401.html';
    }
  },

  /**
   * Comprueba si el usuario y contraseña son válidos
   * @param {string} user_name
   * @param {string} user_pass
   * @returns {Promise<true|string>} true si válido, string con mensaje de error si no
   */
  async checkUserPass(user_name, user_pass) {
    try {
      const usersData = await fetch('data/users.json').then(r => r.json());
      if (!usersData || !Array.isArray(usersData.users)) return 'No users';
      const user = usersData.users.find(u => u.name === user_name);
      if (!user) return 'Usuari no trobat';
      function waitForBcrypt() {
        return new Promise(resolve => {
          (function check() {
            if (window.dcodeIO && window.dcodeIO.bcrypt) resolve(window.dcodeIO.bcrypt);
            else if (window.bcryptjs) resolve(window.bcryptjs);
            else if (window.bcrypt) resolve(window.bcrypt);
            else setTimeout(check, 50);
          })();
        });
      }
      const bcrypt = await waitForBcrypt();
      if (!bcrypt.compareSync(user_pass, user.password_hash)) return 'Contrasenya incorrecta';
      return true;
    } catch (e) {
      return 'Error de validació';
    }
  }

};
if (typeof window !== 'undefined') {
  window.login = login;
}
