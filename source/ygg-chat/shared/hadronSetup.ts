export interface HadronSetupItem {id:string;name:string;ready:boolean;required:boolean;detail:string;download?:string}
export interface HadronSetupReport {items:HadronSetupItem[];packaged:boolean;version:string}
