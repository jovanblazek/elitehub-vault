import dotenv from 'dotenv';
let isLoaded = false;
export const loadEnvironment = () => {
    if (isLoaded) {
        return;
    }
    dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || '.env' });
    isLoaded = true;
};
export const getRequiredEnv = (name) => {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
};
//# sourceMappingURL=environment.js.map