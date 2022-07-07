import { convertTransaction } from '../../../converters'

describe('convertTransaction', () => {
  it.each([
    [
      {
        id: '97b7faa9-0dfd-42bb-b080-aaba04e53f5e',
        companyId: '0c697463-a4dd-438d-b4bd-a9a8033fd870',
        status: 'Executed',
        category: 'Credit',
        contragentName: 'МОСКОВСКИЙ ФИЛИАЛ АО КБ "МОДУЛЬБАНК"',
        contragentInn: '2204000595',
        contragentKpp: '771543001',
        contragentBankAccountNumber: '47423810370010137347',
        contragentBankName: 'МОСКОВСКИЙ ФИЛИАЛ АО КБ "МОДУЛЬБАНК"',
        contragentBankBic: '044525092',
        currency: 'RUR',
        amount: 20.88,
        bankAccountNumber: '40702810270010117619',
        paymentPurpose: 'Комиссия за ежемесячное обслуживание  за период с 01.09.2019 по 30.09.2019. НДС нет.',
        executed: '2019-08-31T00:00:00',
        created: '2019-08-31T00:00:00',
        docNumber: '997067',
        absId: '24879801694',
        ibsoId: '24879801831',
        kbk: '',
        oktmo: '',
        paymentBasis: '',
        taxCode: '',
        taxDocNum: '',
        taxDocDate: '',
        payerStatus: '',
        uin: '0'
      },
      {
        hold: false,
        date: new Date('2019-08-31T00:00:00+03:00'),
        movements: [
          {
            id: '97b7faa9-0dfd-42bb-b080-aaba04e53f5e',
            account: { id: 'account' },
            invoice: null,
            sum: -20.88,
            fee: 0
          }
        ],
        merchant: null,
        comment: 'Комиссия за ежемесячное обслуживание  за период с 01.09.2019 по 30.09.2019. НДС нет.'
      }
    ],
    [
      {
        cardId: 'f954ebce-f20f-478b-a033-aa8f02ec6690',
        id: '7afa4451-61f4-46c1-8d1e-928051926804',
        companyId: '5b3ee23f-071d-4da4-b31e-a7d10408df59',
        status: 'Executed',
        category: 'Credit',
        contragentName: 'МОСКОВСКИЙ ФИЛИАЛ АО КБ "МОДУЛЬБАНК"',
        contragentInn: '2204000595',
        contragentKpp: '771543001',
        contragentBankAccountNumber: '30232810170000000002',
        contragentBankName: 'МОСКОВСКИЙ ФИЛИАЛ АО КБ "МОДУЛЬБАНК"',
        contragentBankBic: '044525092',
        currency: 'RUR',
        amount: 122,
        bankAccountNumber: '40802810470014241168',
        paymentPurpose: 'Безналичная оплата товаров и услуг с использованием банковской карты и/или ее реквизитов YANDEX TAXI 16 UL  LVA TOLSTOGO RUS MOSKVA',
        executed: '2019-09-03T00:00:00',
        created: '2019-09-03T00:00:00',
        docNumber: '234677',
        absId: '24964397197',
        ibsoId: '24964397269',
        kbk: '',
        oktmo: '',
        paymentBasis: '',
        taxCode: '',
        taxDocNum: '',
        taxDocDate: '',
        payerStatus: '',
        uin: '0'
      },
      {
        hold: false,
        date: new Date('2019-09-03T00:00:00+03:00'),
        movements: [
          {
            id: '7afa4451-61f4-46c1-8d1e-928051926804',
            account: { id: 'account' },
            invoice: null,
            sum: -122,
            fee: 0
          }
        ],
        merchant: {
          fullTitle: 'YANDEX TAXI 16 UL  LVA TOLSTOGO RUS MOSKVA',
          mcc: null,
          location: null
        },
        comment: null
      }
    ],
    [
      {
        id: '556a1dd5-a27a-46b5-98a8-aa4f02e6683f',
        companyId: '2ab62271-88e4-4d9c-88e1-a71d02a3847b',
        status: 'Executed',
        category: 'Credit',
        contragentName: 'УФК по Тульской области (Межрайонная ИФНС России № 12 по Тульской области)',
        contragentInn: '7104014427',
        contragentKpp: '710501001',
        contragentBankAccountNumber: '40101810700000010107',
        contragentBankName: 'ОТДЕЛЕНИЕ ТУЛА',
        contragentBankBic: '047003001',
        currency: 'RUR',
        amount: 7475,
        bankAccountNumber: '40802810470010020260',
        paymentPurpose: 'Авансовый платеж УСН за I квартал 2019 года Сумма 7 475,00р. НДС не облагается',
        executed: '2019-05-16T00:00:00',
        created: '2019-05-16T00:00:00',
        docNumber: '60',
        absId: '21204267341',
        kbk: '18210501011011000110',
        oktmo: '70701000',
        paymentBasis: 'ТП',
        taxCode: 'КВ.01.2019',
        taxDocNum: '0',
        taxDocDate: '0',
        payerStatus: '09',
        uin: '0'
      },
      {
        hold: false,
        date: new Date('2019-05-16T00:00:00+03:00'),
        movements: [
          {
            id: '556a1dd5-a27a-46b5-98a8-aa4f02e6683f',
            account: { id: 'account' },
            invoice: null,
            sum: -7475,
            fee: 0
          }
        ],
        merchant: {
          country: null,
          city: null,
          title: 'УФК по Тульской области (Межрайонная ИФНС России № 12 по Тульской области)',
          mcc: null,
          location: null
        },
        comment: 'Авансовый платеж УСН за I квартал 2019 года Сумма 7 475,00р. НДС не облагается'
      }
    ]
  ])('converts outcome', (apiTransaction, transaction) => {
    expect(convertTransaction(apiTransaction, { id: 'account', instrument: 'RUB' })).toEqual(transaction)
  })
})
