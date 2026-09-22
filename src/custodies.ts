export {Custody}

interface Custody {
    id: string
    created_at: string
    custodian: string
    type: 'عهدة مشتريات' | 'عهدة تشغيل وصيانة' | 'عهدة مصاريف سفر' | 'عهدة مكتبية وإدارية' | 'عهدة طوارئ'
    balance: number
    initial_funding: number
}

