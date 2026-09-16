// Zestawy kategorii (SPEC §5.3). To tylko NAZWY kategorii — odpowiedzi wpisują gracze,
// więc żadnych list słów tu nie trzeba.
export const CATEGORY_SETS: Record<string, { name: string; categories: string[] }> = {
  klasyk: {
    name: "Klasyk",
    categories: ["Państwo", "Miasto", "Imię", "Zwierzę", "Roślina", "Rzecz"],
  },
  rozszerzony: {
    name: "Rozszerzony",
    categories: ["Państwo", "Miasto", "Imię", "Zwierzę", "Roślina", "Rzecz", "Zawód", "Marka", "Potrawa", "Film lub serial"],
  },
  popkultura: {
    name: "Popkultura",
    categories: ["Film", "Serial", "Zespół muzyczny", "Postać z gry", "Youtuber/streamer", "Piosenka"],
  },
  wiedza: {
    name: "Wiedza",
    categories: ["Rzeka", "Góra lub pasmo", "Stolica", "Pierwiastek", "Postać historyczna", "Wynalazek"],
  },
  motoryzacja: {
    name: "Motoryzacja",
    categories: ["Marka auta", "Model auta", "Część samochodowa", "Kierowca", "Tor wyścigowy"],
  },
  impreza: {
    name: "Impreza",
    categories: ["Alkohol", "Przekąska", "Powiedzonko", "Coś w tym pokoju", "Kiepska wymówka", "Rzecz, której się wstydzisz"],
  },
};

export type CategorySetId = keyof typeof CATEGORY_SETS;

// Pula liter (SPEC §5.3): polski alfabet bez Q V X Y, czyli bez liter, od których
// nie zaczyna się żadne polskie słowo.
//
// Ł siedziało wcześniej w puli hardcore razem z ogonkami i to był błąd rzeczowy:
// od Ł zaczyna się mnóstwo zwykłych słów (Łódź, Łotwa, łoś, łyżka, łąka), więc
// wyrzucanie go do trybu dla zaawansowanych niepotrzebnie zwężało pulę.
export const BASE_LETTERS = "ABCDEFGHIJKLŁMNOPRSTUWZ".split("");
// Hardcore dokłada ogonki - te zaczynają naprawdę niewiele słów.
export const HARDCORE_LETTERS = "ĄĆĘŃÓŚŹŻ".split("");
