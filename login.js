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

        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.5';

        try {
            if (isLoginMode) {
                // CONNEXION FIREBASE
                await auth.signInWithEmailAndPassword(email, password);
            } else {
                // INSCRIPTION FIREBASE
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;

                // SAUVEGARDE DU PROFIL DANS FIRESTORE
                await db.collection('users').doc(user.email).set({
                    nom,
                    prenom,
                    email,
                    telephone,
                    language,
                    theme: 'dark',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            // Stocker les infos de base localement pour compatibilité immédiate avec le script existant
            localStorage.setItem('isAuthenticated', 'true');
            localStorage.setItem('userEmail', email);
            localStorage.setItem('userName', prenom || email.split('@')[0]);

            // Rediriger vers l'application
            window.location.href = 'app.html';

        } catch (error) {
            console.error(error);
            let errorMsg = "Erreur d'authentification.";
            if (error.code === 'auth/user-not-found') errorMsg = "Utilisateur non trouvé.";
            if (error.code === 'auth/wrong-password') errorMsg = "Mot de passe incorrect.";
            if (error.code === 'auth/email-already-in-use') errorMsg = "Cet email est déjà utilisé.";
            if (error.code === 'auth/weak-password') errorMsg = "Le mot de passe est trop court.";
            
            alert(errorMsg);
        } finally {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
        }
    });
});
