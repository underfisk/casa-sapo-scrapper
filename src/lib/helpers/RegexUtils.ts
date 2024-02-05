import { TypologyId } from '../types';

export class RegexUtils {
    static getUuidFromText(text: string) {
        const uuidRegex = /([a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12})/i;
        return text.match(uuidRegex)?.[1];
    }

    static getYearFromText(text: string) {
        const match = text.match(/(\b\d{4}\b)/);
        if (match) {
            return Number(match[0]);
        }
        return null;
    }

    static getTypologyMatch(content: string) {
        const matches = /\bT[0-7]\b/.exec(content);
        if (matches && matches.length > 0) {
            return matches[0];
        }
        return null;
    }

    static getTypologyId(content: string | string[]) {
        const targets = Array.isArray(content) ? content : [content];

        // If some contain the typology we can simply return it
        for (const target of targets) {
            const foundTypology = RegexUtils.getTypologyMatch(target);
            // Perform a smart check on description to see if we have T0,T1 etc
            switch (foundTypology) {
                case 'T0':
                    return TypologyId.T0;
                case 'T1':
                    return TypologyId.T1;
                case 'T2':
                    return TypologyId.T2;
                case 'T3':
                    return TypologyId.T3;
                case 'T4':
                    return TypologyId.T4;
                case 'T5':
                    return TypologyId.T5;
                case 'T6':
                    return TypologyId.T6;
                case 'T7':
                    return TypologyId.T7;
            }
        }

        return TypologyId.Other;
    }
}
