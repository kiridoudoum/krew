document.addEventListener('DOMContentLoaded', () => {
    const authForm = document.getElementById('auth-form');
    const loginCard = document.querySelector('.login-card');
    const toggleAction = document.getElementById('toggle-action');
    const toggleMsg = document.getElementById('toggle-msg');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const nomInput = document.getElementById('nom');
    const prenomInput = document.getElementById('prenom');
    const telephoneInput = document.getElementById('telephone');
    const langueInput = document.getElementById('langue');
    const submitBtn = document.getElementById('submit-btn');

    let isLoginMode = true;

    // Set initial card class for subtitle toggle
    loginCard.classList.add('login-mode');

    // Toggle entre Connexion et Inscription
    toggleAction.addEventListener('click', () => {
        isLoginMode = !isLoginMode;

        if (isLoginMode) {
            authForm.classList.remove('registration-mode');
            authForm.classList.add('login-mode');
            loginCard.classList.remove('registration-mode');
            loginCard.classList.add('login-mode');

            toggleMsg.innerText = "Pas encore de compte ?";
            toggleAction.innerText = "Créer un compte";
            submitBtn.innerText = "connexion";
        } else {
            authForm.classList.remove('login-mode');
            authForm.classList.add('registration-mode');
            loginCard.classList.remove('login-mode');
            loginCard.classList.add('registration-mode');

            toggleMsg.innerText = "Déjà un compte ?";
            toggleAction.innerText = "Se connecter";
            submitBtn.innerText = "S'inscrire";
        }
    });

    // Écouter la soumission du formulaire
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        const nom = isLoginMode ? '' : nomInput.value.trim();
        const prenom = isLoginMode ? '' : prenomInput.value.trim();
        const telephone = isLoginMode ? '' : telephoneInput.value.trim();
        const language = isLoginMode ? '' : langueInput.value.trim();

        if (!email || !password) return;

        const endpoint = isLoginMode ? '/api/login' : '/api/register';
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.5';

        try {
            const bodyData = { email, password };
            if (!isLoginMode) {
                bodyData.nom = nom;
                bodyData.prenom = prenom;
                bodyData.telephone = telephone;
                bodyData.language = language;
                bodyData.theme = 'dark'; // Add a default theme
            }

            const response = await fetch(`http://localhost:3000${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });

            const data = await response.json();

            if (response.ok) {
                // Stocker 'isAuthenticated'
                localStorage.setItem('isAuthenticated', 'true');
                localStorage.setItem('userEmail', email);

                if (data.user) {
                    if (data.user.username) localStorage.setItem('userName', data.user.username);
                    if (data.user.avatar) localStorage.setItem(`userAvatar_${data.user.email}`, data.user.avatar);
                }

                // Rediriger vers la page principale
                window.location.href = 'index.html';
            } else {
                alert(data.error || "Une erreur est survenue");
            }
        } catch (error) {
            console.error(error);
            alert("Erreur de connexion au serveur.");
        } finally {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
        }
    });
});
