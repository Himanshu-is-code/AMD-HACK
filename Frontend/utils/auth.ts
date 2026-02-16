export const handleGoogleLogin = () => {
    // Generate state for security
    const state = Math.random().toString(36).substring(7);
    localStorage.setItem('oauth_state', state);

    const clientId = "26013620017-75eelat7o28ckjat9rjnm84vc27igi1b.apps.googleusercontent.com";
    const redirectUri = "http://localhost:5173";
    const scope = "openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/gmail.readonly";

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}&access_type=offline&prompt=consent`;

    window.location.href = authUrl;
};
