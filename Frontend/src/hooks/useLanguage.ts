import { useState, useEffect } from 'react';
import { translations, type AppLanguage } from '@/locales';

export function useLanguage() {
    const [appLanguage, setAppLanguage] = useState<AppLanguage>(() => {
        return (localStorage.getItem('vivi-lang') as AppLanguage) || 'auto';
    });

    const getAutoLang = (): Exclude<AppLanguage, 'auto'> => {
        const browserLang = navigator.language.split('-')[0];
        if (['vi', 'en', 'zh'].includes(browserLang)) return browserLang as Exclude<AppLanguage, 'auto'>;
        return 'vi';
    };

    const langKey = (appLanguage === 'auto' ? getAutoLang() : appLanguage) as Exclude<AppLanguage, 'auto'>;
    const t = translations[langKey] || translations.vi;

    const changeLanguage = (newLang: AppLanguage) => {
        setAppLanguage(newLang);
        localStorage.setItem('vivi-lang', newLang);
        // Dispatch custom event to notify other components in same tab
        window.dispatchEvent(new Event('vivi-lang-change'));
    };

    useEffect(() => {
        const handleStorageChange = () => {
            const stored = localStorage.getItem('vivi-lang') as AppLanguage;
            if (stored && stored !== appLanguage) {
                setAppLanguage(stored);
            }
        };
        window.addEventListener('vivi-lang-change', handleStorageChange);
        window.addEventListener('storage', handleStorageChange);
        return () => {
            window.removeEventListener('vivi-lang-change', handleStorageChange);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [appLanguage]);

    return { appLanguage, langKey, t, setAppLanguage: changeLanguage };
}
