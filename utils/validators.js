const sanitizeInput = (value) => {
    if (typeof value !== 'string') return '';
    return value.trim().toLowerCase();
};

const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return typeof email === 'string' && emailRegex.test(email);
};

const isStrongPassword = (password) => {
    if (typeof password !== 'string') return false;

    const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    return passRegex.test(password);
};

const validateRequired = (fields, requiredKeys) => {
    for (const key of requiredKeys) {
        if (typeof fields[key] !== 'string' ||
            !fields[key].trim()) {
            return `${key} is required`;
        }
    }
    return null;
};

const validateEmail = (email) => {
    if (!email) return 'Email is required';
    if (!isValidEmail(email)) return 'Invalid email format';
    return null;
};

const validatePassword = (password) => {
    if (!password) return 'Password is required';
    if (!isStrongPassword(password)) {
        return 'Password must have 8+ chars, upper, lower, number, and special char';
    }
    return null;
};

module.exports = {
    sanitizeInput,
    isValidEmail,
    isStrongPassword,
    validateRequired,
    validateEmail,
    validatePassword
};