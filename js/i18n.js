/* ============================================================
   Быстросайт — RU/EN dictionary and translation helper.
   Covers fixed app/deck chrome only (labels, headings, buttons,
   slide kickers) — a listing's own content (title, description,
   address, agent name...) is whatever the agent typed and is never
   translated. Thai is intentionally out of scope for now.
   ============================================================ */

window.BSI18n = (function () {
  'use strict';

  var LS_KEY = 'bs-lang';
  var dict = {
    ru: {
      appBrandName: 'Быстросайт',
      appBrandTag: 'Конструктор презентаций объектов недвижимости',

      landingTitle: 'Премиальная интерактивная презентация с живой картой и калькулятором доходности',
      landingSubtitle: 'Заполните карточку объекта — получите готовую презентацию в архитектурно-издательском стиле: удобный PDF для скачивания и интерактивная веб-версия для клиента с калькулятором доходности. Слайд за слайдом, как в примере ниже.',
      landingBadge: 'Первая презентация — бесплатно',
      landingCta: 'Создать свою презентацию →',

      formTitle: 'Новый объект',
      formIntro: 'Заполните карточку объекта — мы соберём из неё готовую презентацию в стиле премиального шаблона. Поля уже заполнены примером, можно сразу нажать «Создать презентацию» и посмотреть результат.',
      formErrorBanner: 'Проверьте отмеченные поля — часть обязательных данных не заполнена.',

      secTypeTitle: 'Тип объекта',
      secTypeHint: 'Определяет, какие поля характеристик показывать ниже, и нужен ли слайд бассейна/двора',
      fPropertyTypeLabel: 'Тип',
      optVilla: 'Вилла', optHouse: 'Дом', optApartment: 'Кондо',

      secAboutTitle: 'Об объекте',
      secAboutHint: 'Название и свободное описание для карточки и обложки презентации',
      fTitleLabel: 'Название объекта *',
      fTitlePh: 'напр. Villa Aurora',
      fDescriptionLabel: 'Описание',
      fDescriptionPh: 'напр. Одноэтажная вилла с приватным бассейном в закрытом посёлке в 7 минутах от пляжа Раваи. Полностью меблирована, панорамное остекление гостиной, тропический сад по периметру участка.',

      secPhrasesTitle: 'Текстовые акценты',
      secPhrasesHint: 'Короткие фразы поверх фото — необязательно. Если оставить пустым, слайд останется просто с фото, без подписи',
      fEmotionPhraseLabel: 'Фраза на слайде «Эмоция»',
      fEmotionPhrasePh: 'напр. Тишина, свет и вода',
      fClosingPhraseLabel: 'Фраза на контактном слайде',
      fClosingPhrasePh: 'напр. Резиденция ждёт своего часа',

      secLocationTitle: 'Локация',
      secLocationHint: 'Адрес и координаты — по ним построим карту на слайде локации',
      fLocationNameLabel: 'Локация *',
      fLocationNamePh: 'напр. Раваи, Пхукет, Таиланд',
      fCoordsPasteLabel: 'Вставить координаты из Google Maps',
      fCoordsPastePh: 'напр. 7.7654321, 98.3086543',
      fCoordsPasteHint: 'В Google Maps: долгое нажатие на точку на карте → скопируйте появившиеся координаты и вставьте сюда, поля ниже заполнятся сами',
      fLatLabel: 'Широта (lat) *',
      fLngLabel: 'Долгота (lng) *',

      secPriceTitle: 'Цена',
      secPriceHint: 'Укажите продажу, аренду или оба варианта — хотя бы одно поле обязательно',
      fCurrencyLabel: 'Валюта',
      fSalePriceLabel: 'Цена продажи',
      fRentPriceLabel: 'Цена аренды',
      fRentPeriodLabel: 'Период аренды',
      optPerMonth: '/мес.', optPerDay: '/сутки',
      fRentMarketRangeLabel: 'Рыночная вилка аренды по годовому контракту в районе',
      fRentMarketRangePh: 'напр. 80 000 – 110 000 THB / мес.',

      secParamsTitle: 'Параметры объекта',
      fHouseAreaLabel: 'Площадь дома, м² *',
      fPlotAreaLabel: 'Площадь участка, м²',
      fBedroomsLabel: 'Спальни *',
      fBathroomsLabel: 'Ванные *',
      fPoolSizeLabel: 'Размер бассейна',
      fPoolSizePh: 'напр. 3 × 7 м',

      secFeaturesTitle: 'Характеристики и удобства',
      secFeaturesHint: 'Всё необязательно — появится на слайде «Пространство для жизни», если заполнено. Набор полей зависит от типа объекта',
      fYardLabel: 'Двор',
      fYardPh: 'напр. огороженный, с газоном',
      fFloorsLabel: 'Этажность',
      fFloorNumberLabel: 'Этаж',
      fFurnishedLabel: 'Мебель',
      optFurnishedNone: 'Не указано', optFurnishedFull: 'Полностью меблирована',
      optFurnishedPartial: 'Частично меблирована', optFurnishedEmpty: 'Без мебели',
      fGarageSpacesLabel: 'Гараж, машиномест',
      fSecurityLabel: 'Круглосуточная охрана',
      fAutoGateLabel: 'Автоматические ворота',
      fExtraFeaturesLabel: 'Дополнительные преимущества',
      fExtraFeaturesPh: 'напр. видовая терраса, смарт-дом, мебель premium-класса',

      secNearbyTitle: 'Что рядом',
      secNearbyHint: 'Необязательно. По одному месту на строке — «Название — время или расстояние». Используется на слайдах «Локация» и «Что рядом»',
      fNearbyLabel: 'Места рядом',
      fNearbyPh: 'Пляж Раваи — 7 минут\nМыс Промтеп — 10 минут\nМеждународная школа — 12 минут\nСупермаркет Villa Market — 5 минут\nЙога-шала — 3 минуты\nАэропорт Пхукета — 40 минут',

      secMgmtTitle: 'Управление и расходы',
      secMgmtHint: 'Необязательно — появится на слайде «Ежемесячные расходы», если заполнено',
      fManagementCompanyLabel: 'Управляющая компания',
      fCamFeeLabel: 'CAM fee (в месяц)',
      fCleaningFeeLabel: 'Клининг',
      fCleaningPeriodLabel: 'Периодичность клининга',
      fPoolMaintenanceFeeLabel: 'Обслуживание бассейна (в месяц)',
      optPerWeek: '/нед.', optPerYear: '/год',

      secPhotosTitle: 'Фотографии',
      secPhotosHint: 'Каждый слот соответствует конкретному месту в презентации — кликните по слоту, чтобы загрузить нужный кадр. Список спален и ванных пересчитывается по полям «Параметры объекта» выше. Можно оставить пустым — слайды покажут плейсхолдеры',
      fColorGradeLabel: 'Применить цветокоррекцию',
      fColorGradeHint: 'Плёночный вид: приглушённые тона, тёплый баланс белого, мягкая виньетка и лёгкая рельефность текстур — применяется автоматически к каждому загруженному фото',
      photoAddCount: '{filled} / {total} фотографий загружено',
      slotThumbTitle: 'Загрузить фото',
      slotRemoveLabel: 'Удалить фото',

      secLogoTitle: 'Логотип и название агентства',
      secLogoHint: 'Необязательно — оба элемента вместе появятся в правом верхнем углу каждого слайда презентации',
      fCompanyNameLabel: 'Название компании/агентства',
      fCompanyNamePh: 'напр. Aurora Estate Realty',
      logoNoLogo: 'Нет логотипа',
      logoAddBtn: 'Загрузить логотип',
      logoRemoveBtn: 'Удалить',

      secAgentTitle: 'Контакты агента',
      secAgentHint: 'Появятся на последнем слайде презентации — контактной карточке для клиента',
      fAgentNameLabel: 'Имя агента',
      fAgentNamePh: 'напр. Анна Соломинова',
      fAgentPhoneLabel: 'Телефон *', fAgentPhonePh: '+7 900 000-00-00',
      fAgentPhoneError: 'Пожалуйста, заполните номер телефона',
      agentPhotoNone: 'Нет фото',
      agentPhotoAddBtn: 'Загрузить фото',
      fAgentMessengersLabel: 'Мессенджеры на карточке (не более двух)',
      qrAddLabel: 'Загрузить QR',

      fConsentLabelPrefix: 'Я согласен с ',
      fConsentPolicyLink: 'политикой обработки персональных данных',
      fConsentHint: 'Чтобы поставить галочку, откройте и дочитайте политику до конца',
      fConsentError: 'Чтобы продолжить, подтвердите согласие с политикой обработки персональных данных',
      footerCopyright: '© Быстросайт. Все права защищены.',
      footerPrivacyLink: 'Политика обработки персональных данных',
      footerLegalInfo: 'Самозанятый Соломинова Анна Викторовна · ИНН 027600146568',
      footerOfertaLink: 'Публичная оферта',
      footerPricingLink: 'Тарифы',
      policyModalHint: 'Долистайте текст до конца, чтобы согласиться',
      policyModalHintRead: 'Прочитано — теперь можно поставить галочку',
      policyModalClose: 'Закрыть',

      submitBtn: 'Создать презентацию →',
      deckBackBtn: '← Редактировать',
      deckShareBtn: 'Поделиться',
      deckPdfBtn: 'Скачать PDF',
      deckPdfPreparing: 'Готовим PDF…',
      deckPdfError: 'Не удалось создать PDF. Попробуйте ещё раз.',
      deckLoading: 'Загрузка презентации…',
      deckNotFound: 'Презентация не найдена — возможно, ссылка устарела.',
      deckExpiredTitle: 'Презентация больше не активна — бесплатный период (30 дней) истёк',
      deckExpiredCta: 'Продлить доступ →',
      pdfMapFallback: 'Интерактивная карта доступна в веб-версии презентации',
      deckNavAria: 'Навигация по слайдам',

      editGateMessage: 'Чтобы редактировать эту презентацию, подтвердите номер телефона агента, указанный при её создании.',
      editGatePhoneLabel: 'Номер телефона',
      editGateSubmitBtn: 'Подтвердить',
      editGateError: 'Неверный номер телефона. Попробуйте ещё раз.',

      finalizeConfirmFree: 'После формирования ссылки или скачивания PDF редактирование этого объекта станет недоступно. Продолжить?',
      finalizeConfirmCredit: 'Это не первая финализация этого объекта — будет списана 1 презентация из вашего пакета (останется {credits}). После этого редактирование снова станет недоступно. Продолжить?',
      finalizeCancel: 'Отмена',
      finalizeContinue: 'Продолжить',
      finalizeBlockedMessage: 'Презентация уже отправлена или скачана. Оформите платный доступ, чтобы продолжить редактирование.',
      finalizeBlockedClose: 'Закрыть',
      finalizeGoPay: 'Перейти к оплате',
      finalizeStillSaving: 'Презентация ещё сохраняется, подождите пару секунд и попробуйте снова.',
      finalizeSaveFailed: 'Не удалось сохранить презентацию на сервере. Проверьте соединение и попробуйте ещё раз — мы повторили попытку сохранения автоматически.',
      finalizeError: 'Не удалось выполнить действие. Попробуйте ещё раз.',
      photoDecodeError: 'Не удалось обработать это фото — попробуйте другое или другой формат.',
      shareCopied: 'Ссылка скопирована! Теперь вставьте её в WhatsApp, Telegram или куда хотите отправить (зажмите поле ввода → «Вставить»).',
      shareCopyManual: 'Скопируйте ссылку на презентацию:',

      pricingTitle: 'Тарифы',
      pricingIntro: 'Первая презентация с этим номером телефона уже была создана бесплатно. Чтобы создать следующую, выберите тариф.',
      pricingCreditsNote: 'Презентации из пакета не сгорают — они закрепляются за вашим номером телефона и остаются доступны в любое время, использовать сразу все не обязательно.',
      pricingSingleTitle: 'Разовая',
      pricingPack5Title: '5 презентаций',
      pricingPackTitle: '20 презентаций',
      pricingUnlimitedTitle: 'Безлимит',
      pricingPerMonth: '/мес',
      pricingFeaturePdf: 'PDF-версия презентации',
      pricingFeatureLiveLink: 'Живая интерактивная ссылка',
      pricingFeatureAssets: 'Свой логотип, фото, QR-коды',
      pricingFeatureWatermarkOn: 'Водяной знак «Быстросайт»',
      pricingFeatureWatermarkOff: 'Без водяного знака',
      pricingPayBtn: 'Оплатить',
      pricingBack: '← Назад к форме',
      pricingPaymentClose: '← Назад к тарифам',
      pricingActivationDelay: 'Доступ откроется автоматически сразу после оплаты',
      pricingPayPhoneLabel: 'Номер телефона (на него будет привязан доступ)',
      pricingPayPhoneError: 'Укажите номер телефона',
      pricingPayGoBtn: 'Перейти к оплате →',
      pricingPayError: 'Не удалось создать ссылку на оплату. Попробуйте ещё раз или напишите нам.',
      pricingTimerLink: 'Написать в Telegram: @proff_broker →',

      pricingConsentLabelPrefix: 'Я согласен с ',
      pricingConsentLink: 'согласием на обработку персональных данных и передачу третьим лицам',
      pricingConsentHint: 'Чтобы поставить галочку, откройте и дочитайте согласие до конца',
      pricingConsentError: 'Чтобы продолжить, подтвердите согласие на обработку персональных данных',
      pricingConsentModalHint: 'Долистайте текст до конца, чтобы согласиться',
      pricingConsentModalHintRead: 'Прочитано — теперь можно поставить галочку',
      pricingConsentModalClose: 'Закрыть',
      deckPrevAria: 'Предыдущий слайд',
      deckNextAria: 'Следующий слайд',

      slotCover: 'Обложка — главный вид виллы снаружи',
      slotEmotion: 'Атмосферный кадр — бассейн, гостиная или терраса в мягком свете',
      slotFacade1: 'Фото фасада дома — крупный, красивый ракурс здания',
      slotFacade2: 'Фасад дома — второй ракурс (другая сторона или угол)',
      slotFacade3: 'Фасад / экстерьер — доп. ракурс 3 (по желанию, для черновой отделки без фото интерьера)',
      slotFacade4: 'Фасад / экстерьер — доп. ракурс 4 (по желанию)',
      slotLiving: 'Гостиная и/или кухня целиком',
      slotPool: 'Бассейн',
      slotTerrace: 'Терраса, двор или зона отдыха на улице',
      slotTerrace2: 'Терраса / двор — дополнительный ракурс (по желанию)',
      slotDetail1: 'Деталь 1 — материалы, текстуры (интерьер или фасад)',
      slotDetail2: 'Деталь 2 — свет и атмосфера (интерьер или фасад)',
      slotDetail3: 'Деталь 3 — на ваш выбор (интерьер или фасад)',
      slotInteriorHall: 'Холл', slotInteriorKitchen: 'Кухня',
      slotInteriorDining: 'Столовая', slotInteriorExtra: 'Дополнительное пространство',
      slotBedroom: 'Спальня', slotBathroom: 'Ванная', slotOutOf: 'из',
      slotFinal: 'Финальный кадр — вечерний вид виллы',

      deckResidence: 'Частная резиденция',
      deckCoverLabel: 'Обложка',
      deckEmotionLabel: 'Эмоция',
      deckSpaceLabel: 'Пространство для жизни',
      deckSpaceKicker: 'Пространство',
      deckSpaceTitleL1: 'Пространство', deckSpaceTitleL2: 'для жизни',
      unitSqm: 'м²',
      deckSpecHouse: 'Дом', deckSpecPlot: 'Участок', deckSpecBedrooms: 'Спальни',
      deckSpecBathrooms: 'Ванные', deckSpecPool: 'Бассейн', deckSpecYard: 'Двор',
      deckSpecFloor: 'Этаж', deckSpecFloors: 'Этажность', deckSpecFurnished: 'Мебель',
      deckSpecGarage: 'Гараж', deckSpecGarageUnit: 'машиноместа', deckSpecSecurity: 'Охрана',
      deckSpecSecurityVal: 'Круглосуточная', deckSpecGate: 'Ворота', deckSpecGateVal: 'Автоматические',
      deckSpecManagement: 'Управление', deckExtraLabel: 'Дополнительно',

      deckArchitectureLabel: 'Архитектура',

      deckOutdoorTerritory: 'Территория',
      deckOutdoorPoolAlt: 'Бассейн', deckOutdoorTerraceAlt: 'Терраса, двор',

      deckDetailsLabel: 'Детали',
      deckDetailAlt: 'Деталь интерьера',

      deckInteriorsLabel: 'Интерьеры',

      deckBedroomsGroup: 'Спальни', deckBathroomsGroup: 'Ванные',
      deckBedroomLabel: 'Спальня', deckBathroomLabel: 'Ванная',

      deckLocationLabel: 'Локация', deckMapTitle: 'Карта расположения',
      deckRouteLink: 'Открыть маршрут в Google Maps →',

      deckConditionsLabel: 'Условия', deckSale: 'Продажа', deckRent: 'Аренда',
      deckMonthly: 'Ежемесячно', deckMarketRentPrefix: 'Аренда на годовой контракт в этом районе — ориентировочно',
      calcPurchasePrice: 'Цена покупки', calcRentLabel: 'Аренда',
      calcYieldLabel: 'Годовая доходность', calcPaybackLabel: 'Срок окупаемости',
      calcNetYieldLabel: 'Чистая доходность', calcGrossYieldLabel: 'Валовая доходность',
      calcExpensesLabel: 'Ежемесячные расходы',
      calcYearOne: 'год', calcYearFew: 'года', calcYearMany: 'лет',

      deckContactsLabel: 'Контакты',
      agentPhotoAlt: 'Фото агента',
      photoPlaceholder: 'Фото',
      qrLabel: 'QR ',
      logoAlt: 'Логотип',
      deckLivingAlt: 'Гостиная',
      deckFacadeSuffix: ' — фасад',
      deckEveningSuffix: ' — вечер',
      ariaSlideRole: 'слайд',

      slideAnnounce: 'Слайд {n} из {total}: {label}',

      /* ---------------- Privacy policy page (privacy.html) ----------------
         Source text: Политика_обработки_данных_Быстросайт_Таиланд.docx.
         privacy.html includes this same js/i18n.js and sweeps data-i18n
         itself — one dictionary for the whole site, no separate/duplicated
         translation file for the policy. */
      policyPageTitle: 'Политика обработки персональных данных — Быстросайт',
      policyH1: 'Политика обработки персональных данных',
      policyEffectiveDate: 'Дата вступления в силу: 05.09.2026',

      policySec1Title: '1. Общие положения',
      policySec1P1: 'Настоящая Политика обработки персональных данных (далее — «Политика») действует в отношении всех персональных данных, которые Оператор может получить от пользователя сервиса «Быстросайт» (далее — «Сервис»), доступного по адресу данного сайта и предназначенного для риелторов и агентов недвижимости. Политика разработана в соответствии с Федеральным законом от 27.07.2006 № 152-ФЗ «О персональных данных» (далее — 152-ФЗ).',
      policySec1P2: 'Используя Сервис и заполняя формы на сайте, пользователь подтверждает своё согласие на обработку персональных данных на условиях, изложенных в настоящей Политике. Если пользователь не согласен с условиями Политики, он обязан прекратить использование Сервиса.',

      policySec2Title: '2. Оператор персональных данных',
      policySec2P1: 'Оператором персональных данных является: Самозанятая Соломинова Анна Викторовна, ИНН 027600146568 (далее — «Оператор»).',
      policySec2P2: 'Контакты Оператора для обращений по вопросам обработки персональных данных указаны в разделе 12 настоящей Политики.',

      policySec3Title: '3. Какие данные собираются и цель обработки',
      policySec3Intro: 'При использовании Сервиса Оператор обрабатывает следующие персональные данные пользователя:',
      policySec3Li1: 'номер телефона агента — используется для идентификации пользователя, начисления и списания оплаты за услуги Сервиса, проверки условий бесплатного тарифа и связи с пользователем по вопросам работы Сервиса;',
      policySec3Li2: 'имя и фотография агента — используются для идентификации агента и отображения на создаваемой им странице презентации; хранятся тем же способом, что и номер телефона (см. раздел 5);',
      policySec3Li3: 'логотип, название агентства/компании, фотографии объекта недвижимости, описание, цена и иные сведения, которые пользователь добровольно указывает для отображения на создаваемой им странице презентации, — используются исключительно для формирования и публичного отображения этой презентации по прямой ссылке.',
      policySec3Outro: 'Обработка номера телефона осуществляется только в целях, прямо указанных в настоящем разделе, и не производится в иных целях без получения дополнительного согласия пользователя. Предоставление данных является добровольным; отказ от заполнения обязательных полей технически ограничивает возможность создания презентации и не влечёт иных последствий.',

      policySec4Title: '4. Правовое основание обработки',
      policySec4P1: 'Обработка персональных данных осуществляется на основании согласия пользователя (ст. 9 152-ФЗ), выраженного отдельной отметкой в форме перед отправкой данных. Согласие является конкретным, информированным и сознательным; пользователь вправе отозвать его в любой момент в порядке, указанном в разделе 8 настоящей Политики.',

      policySec5Title: '5. Место хранения персональных данных',
      policySec5P1: 'Номер телефона, имя и фотография агента хранятся на серверах, расположенных на территории Российской Федерации.',
      policySec5P2: 'Иные материалы презентации (логотип, название агентства/компании, фотографии объекта недвижимости, описание, цена и другие сведения, не относящиеся к персональным данным агента) могут храниться с использованием стороннего облачного сервиса, в том числе за пределами территории Российской Федерации.',

      policySec6Title: '6. Срок хранения',
      policySec6P1: 'Номер телефона, имя и фотография агента хранятся в течение всего периода использования Сервиса пользователем — они используются для идентификации пользователя при каждом последующем обращении к Сервису, а не только в рамках одной презентации. Данные удаляются по запросу пользователя в порядке, указанном в разделе 8, либо при прекращении деятельности Оператора.',

      policySec7Title: '7. Передача персональных данных третьим лицам',
      policySec7Intro: 'Оператор не передаёт персональные данные третьим лицам, за исключением:',
      policySec7Li1: 'облачной инфраструктуры, на которой физически размещены персональные данные (сервер на территории Российской Федерации), — используется исключительно для хранения по поручению Оператора, без самостоятельного доступа к данным для собственных целей;',
      policySec7Li2: 'платёжного оператора ООО «Продамус», которому номер телефона передаётся при оплате услуг Сервиса на странице /pricing — согласие на такую передачу пользователь даёт отдельно, на странице /payment-consent, до совершения оплаты;',
      policySec7Li3: 'случаев, прямо предусмотренных законодательством Российской Федерации, — по законному требованию уполномоченных государственных органов.',
      policySec7Outro: 'Публичное отображение номера телефона на странице презентации, созданной по прямому волеизъявлению самого пользователя, не является передачей третьим лицам в смысле настоящей Политики — это основная функциональность Сервиса, на использование которой пользователь даёт согласие.',

      policySec8Title: '8. Права субъекта персональных данных',
      policySec8Intro: 'В соответствии со статьями 14 и 21 152-ФЗ пользователь (субъект персональных данных) имеет право:',
      policySec8Li1: 'получать информацию, касающуюся обработки его персональных данных;',
      policySec8Li2: 'требовать уточнения, блокирования или уничтожения персональных данных, если они являются неполными, устаревшими, неточными, незаконно полученными или не являются необходимыми для заявленной цели обработки;',
      policySec8Li3: 'отозвать согласие на обработку персональных данных в любой момент;',
      policySec8Li4: 'требовать удаления своих персональных данных.',
      policySec8OutroPrefix: 'Для реализации указанных прав пользователь обращается к Оператору: ',
      policySec8OutroSuffix: '. Оператор рассматривает обращение и блокирует/уничтожает данные в срок, установленный 152-ФЗ.',

      policySec9Title: '9. Меры защиты персональных данных',
      policySec9P1: 'Оператор принимает необходимые правовые, организационные и технические меры для защиты персональных данных от неправомерного или случайного доступа, уничтожения, изменения, блокирования, копирования, предоставления, распространения и иных неправомерных действий третьих лиц.',
      policySec9P2: 'Пользователь несёт самостоятельную ответственность за достоверность данных, указанных им при использовании Сервиса.',

      policySec10Title: '10. Файлы cookie и локальное хранилище браузера',
      policySec10P1: 'Сервис не использует файлы cookie для отслеживания, аналитики или рекламы. Для технических целей (например, для запоминания выбранного языка интерфейса) используется локальное хранилище браузера (localStorage), данные из которого не передаются Оператору и не требуют отдельного согласия.',

      policySec11Title: '11. Изменение Политики',
      policySec11P1: 'Оператор вправе вносить изменения в настоящую Политику. Актуальная версия всегда доступна на этой странице. Продолжение использования Сервиса после внесения изменений означает согласие пользователя с обновлённой редакцией Политики.',

      policySec12Title: '12. Контакты Оператора',
      policySec12P1Prefix: 'По вопросам обработки персональных данных пользователь может обратиться к Оператору: ',
      policySec12P1Suffix: '.',

      policyTelegramHandle: '@proff_broker',
      policyBackBtn: '← Назад к форме',

      pconsentPageTitle: 'Согласие на обработку персональных данных — Быстросайт',
      pconsentH1: 'Согласие на обработку персональных данных и передачу третьим лицам',
      pconsentP1: 'Я свободно, своей волей и в своём интересе даю согласие ООО «ПРОДАМУС» (424020, Республика Марий Эл, г. Йошкар-Ола, ул. Анциферова, д. 27 «А», пом. 29) (далее — «Оператор») на обработку моих персональных данных (далее — «Согласие») в целях обработки и подтверждения оплаты услуг сервиса «Быстросайт» через платёжный сервис Оператора, идентификации плательщика и информирования об исполнении платежа.',
      pconsentP2: 'Оператор вправе осуществлять сбор, запись, систематизацию, накопление, хранение, уточнение (обновление, изменение), извлечение, использование, передачу (доступ, предоставление), блокирование, удаление, уничтожение персональных данных. Обработка может осуществляться как с использованием средств автоматизации, так и без них.',

      pconsentSec2Title: 'Перечень персональных данных, на обработку которых я даю согласие',
      pconsentSec2Intro: 'Я даю согласие на обработку следующих персональных данных:',
      pconsentSec2Li1: 'фамилия, имя, отчество;',
      pconsentSec2Li2: 'контактные данные (номер телефона и адрес электронной почты);',
      pconsentSec2Li4: 'сведения о примерном местоположении, определяемом по техническим данным, если такие сведения используются Оператором.',

      pconsentSec3Title: 'Передача третьим лицам',
      pconsentSec3P1: 'Я даю Оператору право привлекать третьих лиц к обработке моих данных путём поручения обработки или передачи без поручения исключительно для достижения указанной цели и в минимально необходимом составе, при условии обеспечения ими конфиденциальности и безопасности. К таким третьим лицам относятся:',
      pconsentSec3Li1: 'ООО «Яндекс.Облако» (119021, г. Москва, ул. Льва Толстого, д. 16, пом. 528);',
      pconsentSec3Li5Prefix: 'а также третьи лица, указанные в «Перечне третьих лиц, привлечённых к обработке ПДн» (',
      pconsentThirdPartyListLink: 'prodamus.ru/privacy-tretilica',
      pconsentSec3Li5Mid: '), являющемся неотъемлемой частью настоящего Согласия и Политики конфиденциальности ООО «Продамус» (',
      pconsentPrivacyPolicyLink: 'prodamus.ru/privacy',
      pconsentSec3Li5Suffix: ').',

      pconsentSec4Title: 'Срок действия',
      pconsentSec4P1: 'Согласие действует с момента его предоставления до достижения целей обработки либо отзыва Согласия — в зависимости от того, какое событие наступит раньше.',

      pconsentSec5Title: 'Порядок отзыва',
      pconsentSec5P1Prefix: 'Согласие может быть отозвано путём направления письменного обращения на электронную почту ',
      pconsentEmail: 'complaints@prodamus.ru',
      pconsentSec5P1Suffix: ' или письмом по адресу Оператора. В случае отзыва Согласия Оператор и третьи лица обязаны прекратить обработку и уничтожить данные, за исключением случаев, когда сохранение данных требуется согласно п. 2–11 ч. 1 ст. 6, ч. 2 ст. 10 и ч. 2 ст. 11 Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных».',

      pconsentBackBtn: '← Назад к тарифам',
    },
    en: {
      appBrandName: 'Bystrosite',
      appBrandTag: 'Real-estate presentation builder',

      landingTitle: 'A premium interactive presentation with a live map and rental-yield calculator',
      landingSubtitle: 'Fill in the property card — get a finished presentation in an editorial-architectural style: a convenient downloadable PDF and an interactive web version for the client with a rental-yield calculator. Slide by slide, like the example below.',
      landingBadge: 'First presentation is free',
      landingCta: 'Build your own presentation →',

      formTitle: 'New Listing',
      formIntro: 'Fill in the property card — we’ll assemble a finished presentation in the premium template style. Fields are pre-filled with an example, so you can hit “Create presentation” right away and see the result.',
      formErrorBanner: 'Check the highlighted fields — some required data is missing.',

      secTypeTitle: 'Property type',
      secTypeHint: 'Determines which spec fields show below, and whether the pool/yard slide is needed',
      fPropertyTypeLabel: 'Type',
      optVilla: 'Villa', optHouse: 'House', optApartment: 'Condo',

      secAboutTitle: 'About the property',
      secAboutHint: 'Title and free-form description for the card and the presentation cover',
      fTitleLabel: 'Property name *',
      fTitlePh: 'e.g. Villa Aurora',
      fDescriptionLabel: 'Description',
      fDescriptionPh: 'e.g. A single-story villa with a private pool in a gated community, 7 minutes from Rawai beach. Fully furnished, floor-to-ceiling living room windows, tropical garden around the plot.',

      secPhrasesTitle: 'Text accents',
      secPhrasesHint: 'Short phrases over photos — optional. Leave blank and the slide stays a plain photo, no caption',
      fEmotionPhraseLabel: 'Phrase on the "Emotion" slide',
      fEmotionPhrasePh: 'e.g. Silence, light, and water',
      fClosingPhraseLabel: 'Phrase on the contact slide',
      fClosingPhrasePh: 'e.g. The residence awaits its moment',

      secLocationTitle: 'Location',
      secLocationHint: 'Address and coordinates — used to build the map on the location slide',
      fLocationNameLabel: 'Location *',
      fLocationNamePh: 'e.g. Rawai, Phuket, Thailand',
      fCoordsPasteLabel: 'Paste coordinates from Google Maps',
      fCoordsPastePh: 'e.g. 7.7654321, 98.3086543',
      fCoordsPasteHint: 'In Google Maps: long-press a point on the map → copy the coordinates that appear and paste them here, the fields below fill in automatically',
      fLatLabel: 'Latitude (lat) *',
      fLngLabel: 'Longitude (lng) *',

      secPriceTitle: 'Price',
      secPriceHint: 'Specify sale, rent, or both — at least one is required',
      fCurrencyLabel: 'Currency',
      fSalePriceLabel: 'Sale price',
      fRentPriceLabel: 'Rent price',
      fRentPeriodLabel: 'Rent period',
      optPerMonth: '/mo.', optPerDay: '/night',
      fRentMarketRangeLabel: 'Market range for a yearly rental contract in the area',
      fRentMarketRangePh: 'e.g. THB 80,000 – 110,000 / mo.',

      secParamsTitle: 'Property parameters',
      fHouseAreaLabel: 'House area, m² *',
      fPlotAreaLabel: 'Plot area, m²',
      fBedroomsLabel: 'Bedrooms *',
      fBathroomsLabel: 'Bathrooms *',
      fPoolSizeLabel: 'Pool size',
      fPoolSizePh: 'e.g. 3 × 7 m',

      secFeaturesTitle: 'Features and amenities',
      secFeaturesHint: 'All optional — appears on the "Living space" slide if filled in. The field set depends on property type',
      fYardLabel: 'Yard',
      fYardPh: 'e.g. fenced, with lawn',
      fFloorsLabel: 'Floors',
      fFloorNumberLabel: 'Floor number',
      fFurnishedLabel: 'Furnishing',
      optFurnishedNone: 'Not specified', optFurnishedFull: 'Fully furnished',
      optFurnishedPartial: 'Partially furnished', optFurnishedEmpty: 'Unfurnished',
      fGarageSpacesLabel: 'Garage, parking spaces',
      fSecurityLabel: '24/7 security',
      fAutoGateLabel: 'Automatic gate',
      fExtraFeaturesLabel: 'Extra highlights',
      fExtraFeaturesPh: 'e.g. rooftop view terrace, smart home, premium-class furniture',

      secNearbyTitle: 'What’s nearby',
      secNearbyHint: 'Optional. One place per line — "Name — time or distance". Used on the "Location" and "Nearby" slides',
      fNearbyLabel: 'Nearby places',
      fNearbyPh: 'Rawai Beach — 7 min\nPromthep Cape — 10 min\nInternational school — 12 min\nVilla Market supermarket — 5 min\nYoga shala — 3 min\nPhuket Airport — 40 min',

      secMgmtTitle: 'Management & costs',
      secMgmtHint: 'Optional — appears on the "Monthly costs" slide if filled in',
      fManagementCompanyLabel: 'Management company',
      fCamFeeLabel: 'CAM fee (per month)',
      fCleaningFeeLabel: 'Cleaning',
      fCleaningPeriodLabel: 'Cleaning frequency',
      fPoolMaintenanceFeeLabel: 'Pool maintenance (per month)',
      optPerWeek: '/wk.', optPerYear: '/yr.',

      secPhotosTitle: 'Photos',
      secPhotosHint: 'Each slot maps to a specific spot in the presentation — click a slot to upload the right shot. The bedroom/bathroom list recalculates from the "Property parameters" fields above. Fine to leave empty — slides will show placeholders',
      fColorGradeLabel: 'Apply color grading',
      fColorGradeHint: 'Film-style look: muted tones, warm white balance, a soft vignette and light texture depth — applied automatically to every uploaded photo',
      photoAddCount: '{filled} / {total} photos uploaded',
      slotThumbTitle: 'Upload photo',
      slotRemoveLabel: 'Remove photo',

      secLogoTitle: 'Agency logo & name',
      secLogoHint: 'Optional — both appear together in the top-right corner of every slide',
      fCompanyNameLabel: 'Company/agency name',
      fCompanyNamePh: 'e.g. Aurora Estate Realty',
      logoNoLogo: 'No logo',
      logoAddBtn: 'Upload logo',
      logoRemoveBtn: 'Remove',

      secAgentTitle: 'Agent contacts',
      secAgentHint: 'Appear on the last slide of the presentation — the client contact card',
      fAgentNameLabel: 'Agent name',
      fAgentNamePh: 'e.g. Anna Solominova',
      fAgentPhoneLabel: 'Phone *', fAgentPhonePh: '+1 555 000-00-00',
      fAgentPhoneError: 'Please fill in the phone number',
      agentPhotoNone: 'No photo',
      agentPhotoAddBtn: 'Upload photo',
      fAgentMessengersLabel: 'Messengers on the card (up to two)',
      qrAddLabel: 'Upload QR',

      fConsentLabelPrefix: 'I agree to the ',
      fConsentPolicyLink: 'Privacy Policy',
      fConsentHint: 'Open and read the policy all the way through to enable the checkbox',
      fConsentError: 'Please confirm you agree to the privacy policy to continue',
      footerCopyright: '© Bystrosite. All rights reserved.',
      footerPrivacyLink: 'Privacy Policy',
      footerLegalInfo: 'Self-employed Anna Solominova · TIN 027600146568',
      footerOfertaLink: 'Public Offer',
      footerPricingLink: 'Pricing',
      policyModalHint: 'Scroll to the end of the text to agree',
      policyModalHintRead: 'Read — you can now check the box',
      policyModalClose: 'Close',

      submitBtn: 'Create presentation →',
      deckBackBtn: '← Edit',
      deckShareBtn: 'Share',
      deckPdfBtn: 'Download PDF',
      deckPdfPreparing: 'Preparing PDF…',
      deckPdfError: 'Could not create the PDF. Please try again.',
      deckLoading: 'Loading presentation…',
      deckNotFound: 'Presentation not found — the link may be out of date.',
      deckExpiredTitle: 'This presentation is no longer active — its 30-day free period has ended',
      deckExpiredCta: 'Extend access →',
      pdfMapFallback: 'The interactive map is available in the web version of the presentation',
      deckNavAria: 'Slide navigation',

      editGateMessage: 'To edit this presentation, confirm the agent phone number it was created with.',
      editGatePhoneLabel: 'Phone number',
      editGateSubmitBtn: 'Confirm',
      editGateError: 'Incorrect phone number. Please try again.',

      finalizeConfirmFree: 'Once you share the link or download the PDF, editing this listing will be locked. Continue?',
      finalizeConfirmCredit: "This isn't this listing's first finalization — 1 presentation will be spent from your package ({credits} left after). Editing will lock again afterward. Continue?",
      finalizeCancel: 'Cancel',
      finalizeContinue: 'Continue',
      finalizeBlockedMessage: 'This presentation has already been shared or downloaded. Get paid access to keep editing it.',
      finalizeBlockedClose: 'Close',
      finalizeGoPay: 'Go to payment',
      finalizeStillSaving: 'The presentation is still saving — wait a couple seconds and try again.',
      finalizeSaveFailed: 'Could not save the presentation to the server. Check your connection and try again — we already retried the save automatically.',
      finalizeError: 'Could not complete the action. Please try again.',
      photoDecodeError: 'Could not process this photo — try another one or a different format.',
      shareCopied: 'Link copied! Now paste it into WhatsApp, Telegram, or wherever you want to send it (long-press the input field → Paste).',
      shareCopyManual: 'Copy the presentation link:',

      pricingTitle: 'Pricing',
      pricingIntro: 'A free presentation was already created with this phone number. To create another, choose a plan.',
      pricingCreditsNote: "Presentations in a package don't expire — they're tied to your phone number and stay available any time, you don't have to use them all at once.",
      pricingSingleTitle: 'One-off',
      pricingPack5Title: '5 presentations',
      pricingPackTitle: '20 presentations',
      pricingUnlimitedTitle: 'Unlimited',
      pricingPerMonth: '/mo',
      pricingFeaturePdf: 'PDF version of the presentation',
      pricingFeatureLiveLink: 'Live interactive link',
      pricingFeatureAssets: 'Your own logo, photos, QR codes',
      pricingFeatureWatermarkOn: '"Bystrosite" watermark',
      pricingFeatureWatermarkOff: 'No watermark',
      pricingPayBtn: 'Pay',
      pricingBack: '← Back to form',
      pricingPaymentClose: '← Back to plans',
      pricingActivationDelay: 'Access unlocks automatically right after payment',
      pricingPayPhoneLabel: 'Phone number (access is tied to it)',
      pricingPayPhoneError: 'Please enter a phone number',
      pricingPayGoBtn: 'Go to payment →',
      pricingPayError: "Couldn't create a payment link. Please try again or message us.",
      pricingTimerLink: 'Message on Telegram: @proff_broker →',

      pricingConsentLabelPrefix: 'I agree to the ',
      pricingConsentLink: 'consent to processing of personal data and transfer to third parties',
      pricingConsentHint: 'To check the box, open and read the consent all the way through',
      pricingConsentError: 'To continue, confirm consent to the processing of personal data',
      pricingConsentModalHint: 'Scroll to the end of the text to agree',
      pricingConsentModalHintRead: 'Read — you can now check the box',
      pricingConsentModalClose: 'Close',
      deckPrevAria: 'Previous slide',
      deckNextAria: 'Next slide',

      slotCover: 'Cover — the villa’s main exterior view',
      slotEmotion: 'Atmosphere shot — pool, living room, or terrace in soft light',
      slotFacade1: 'Facade photo — a large, striking angle of the building',
      slotFacade2: 'Facade — second angle (other side or corner)',
      slotFacade3: 'Facade / exterior — extra angle 3 (optional, for shell-finish units with no interior photos)',
      slotFacade4: 'Facade / exterior — extra angle 4 (optional)',
      slotLiving: 'Living room and/or kitchen, full view',
      slotPool: 'Pool',
      slotTerrace: 'Terrace, yard, or outdoor lounge area',
      slotTerrace2: 'Terrace / yard — additional angle (optional)',
      slotDetail1: 'Detail 1 — materials, textures (interior or facade)',
      slotDetail2: 'Detail 2 — light and atmosphere (interior or facade)',
      slotDetail3: 'Detail 3 — your choice (interior or facade)',
      slotInteriorHall: 'Hall', slotInteriorKitchen: 'Kitchen',
      slotInteriorDining: 'Dining room', slotInteriorExtra: 'Additional space',
      slotBedroom: 'Bedroom', slotBathroom: 'Bathroom', slotOutOf: 'of',
      slotFinal: 'Final shot — evening view of the villa',

      deckResidence: 'Private residence',
      deckCoverLabel: 'Cover',
      deckEmotionLabel: 'Emotion',
      deckSpaceLabel: 'Living space',
      deckSpaceKicker: 'Space',
      deckSpaceTitleL1: 'Living', deckSpaceTitleL2: 'space',
      unitSqm: 'm²',
      deckSpecHouse: 'House', deckSpecPlot: 'Plot', deckSpecBedrooms: 'Bedrooms',
      deckSpecBathrooms: 'Bathrooms', deckSpecPool: 'Pool', deckSpecYard: 'Yard',
      deckSpecFloor: 'Floor', deckSpecFloors: 'Floors', deckSpecFurnished: 'Furnishing',
      deckSpecGarage: 'Garage', deckSpecGarageUnit: 'parking spaces', deckSpecSecurity: 'Security',
      deckSpecSecurityVal: '24/7', deckSpecGate: 'Gate', deckSpecGateVal: 'Automatic',
      deckSpecManagement: 'Management', deckExtraLabel: 'Additional',

      deckArchitectureLabel: 'Architecture',

      deckOutdoorTerritory: 'Grounds',
      deckOutdoorPoolAlt: 'Pool', deckOutdoorTerraceAlt: 'Terrace, yard',

      deckDetailsLabel: 'Details',
      deckDetailAlt: 'Interior detail',

      deckInteriorsLabel: 'Interiors',

      deckBedroomsGroup: 'Bedrooms', deckBathroomsGroup: 'Bathrooms',
      deckBedroomLabel: 'Bedroom', deckBathroomLabel: 'Bathroom',

      deckLocationLabel: 'Location', deckMapTitle: 'Location map',
      deckRouteLink: 'Open route in Google Maps →',

      deckConditionsLabel: 'Terms', deckSale: 'Sale', deckRent: 'Rent',
      deckMonthly: 'Monthly', deckMarketRentPrefix: 'Yearly-contract rent in this area — approximately',
      calcPurchasePrice: 'Purchase price', calcRentLabel: 'Rent',
      calcYieldLabel: 'Annual yield', calcPaybackLabel: 'Payback period',
      calcNetYieldLabel: 'Net yield', calcGrossYieldLabel: 'Gross yield',
      calcExpensesLabel: 'Monthly expenses',
      calcYearOne: 'year', calcYearFew: 'years', calcYearMany: 'years',

      deckContactsLabel: 'Contacts',
      agentPhotoAlt: 'Agent photo',
      photoPlaceholder: 'Photo',
      qrLabel: 'QR ',
      logoAlt: 'Logo',
      deckLivingAlt: 'Living room',
      deckFacadeSuffix: ' — facade',
      deckEveningSuffix: ' — evening',
      ariaSlideRole: 'slide',

      slideAnnounce: 'Slide {n} of {total}: {label}',

      /* privacy.html and payment-consent.html have no English version —
         both are Russian legal documents (152-ФЗ), and translating
         "самозанятая"/ИНН/152-ФЗ citations would be inaccurate, not helpful
         (same reasoning oferta.html's own comment already gives for
         skipping a lang switch there). Neither page has an RU/EN switch;
         t() falls back to the RU strings above for any policy- or
         pconsent-prefixed key if ever read with lang 'en'. */
    },
  };

  var lang = 'ru';
  try { lang = localStorage.getItem(LS_KEY) || 'ru'; } catch (e) {}
  if (dict[lang] === undefined) lang = 'ru';

  function t(key, vars) {
    var s = (dict[lang] && dict[lang][key] != null) ? dict[lang][key] : (dict.ru[key] || key);
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = s.replace('{' + k + '}', vars[k]);
      });
    }
    return s;
  }

  function getLang() { return lang; }

  /* persist=false renders in language `l` without touching the visitor's
     own saved preference (LS_KEY) or requiring it to differ from the
     current in-memory lang — used to render a shared /p/<id> or /edit/<id>
     listing in the language it was *created* in (see listings.language,
     0005_language_and_edit_lockdown.sql), independent of whatever language
     this browser last had selected on the landing/form pages. persist=true
     (the default, used by the landing page's RU/EN buttons) is a real,
     sticky preference change. */
  function setLang(l, persist) {
    if (!dict[l]) return;
    if (persist === false) { lang = l; return; }
    if (l === lang) return;
    lang = l;
    try { localStorage.setItem(LS_KEY, l); } catch (e) {}
  }

  // Applies data-i18n / data-i18n-placeholder text on static (non-deck) DOM —
  // the form and landing page. Deck slide chrome is built fresh from t() each
  // render (see js/deck.js), so it never needs a DOM sweep.
  function apply() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
    });
    document.querySelectorAll('[data-i18n-alt]').forEach(function (el) {
      el.alt = t(el.getAttribute('data-i18n-alt'));
    });
    document.querySelectorAll('.lang-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });
    document.documentElement.lang = lang;
  }

  return { t: t, getLang: getLang, setLang: setLang, apply: apply };
})();
