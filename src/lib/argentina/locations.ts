export const PROVINCES = [
  "Buenos Aires",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Ciudad Autónoma de Buenos Aires",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
] as const;

export type Province = (typeof PROVINCES)[number];

export const CITIES = [
  // Buenos Aires
  "Buenos Aires", "La Plata", "Mar del Plata", "Bahía Blanca", "Quilmes",
  "Lanús", "Lomas de Zamora", "General San Martín", "Morón", "Tigre",
  "Avellaneda", "San Isidro", "Tres de Febrero", "Merlo", "Moreno",
  "Almirante Brown", "Florencio Varela", "Berazategui", "Ezeiza", "Tandil",
  // CABA
  "Ciudad Autónoma de Buenos Aires",
  // Córdoba
  "Córdoba", "Villa María", "Río Cuarto", "San Francisco", "Villa Carlos Paz",
  "Alta Gracia", "Bell Ville", "Jesús María", "Cosquín", "La Calera",
  // Santa Fe
  "Rosario", "Santa Fe", "Rafaela", "Venado Tuerto", "Santo Tomé",
  "Reconquista", "Villa Gobernador Gálvez",
  // Mendoza
  "Mendoza", "San Rafael", "Godoy Cruz", "Guaymallén", "Las Heras",
  "Luján de Cuyo", "Maipú",
  // Tucumán
  "San Miguel de Tucumán", "Tafí Viejo", "Yerba Buena", "Banda del Río Salí",
  // Salta
  "Salta", "San Ramón de la Nueva Orán", "Tartagal",
  // Misiones
  "Posadas", "Oberá", "Eldorado", "Puerto Iguazú",
  // Entre Ríos
  "Paraná", "Concordia", "Gualeguaychú", "Colón",
  // Chaco
  "Resistencia", "Presidencia Roque Sáenz Peña",
  // Corrientes
  "Corrientes", "Goya", "Mercedes",
  // Santiago del Estero
  "Santiago del Estero", "La Banda",
  // San Juan
  "San Juan", "Rivadavia",
  // Jujuy
  "San Salvador de Jujuy", "Palpalá",
  // Río Negro
  "San Carlos de Bariloche", "Viedma", "Cipolletti", "Allen",
  // Neuquén
  "Neuquén", "San Martín de los Andes", "Zapala",
  // Formosa
  "Formosa",
  // La Pampa
  "Santa Rosa", "General Pico",
  // Chubut
  "Rawson", "Comodoro Rivadavia", "Puerto Madryn", "Trelew",
  // La Rioja
  "La Rioja",
  // Catamarca
  "San Fernando del Valle de Catamarca",
  // San Luis
  "San Luis", "Villa Mercedes",
  // Santa Cruz
  "Río Gallegos", "Caleta Olivia", "El Calafate",
  // Tierra del Fuego
  "Ushuaia", "Río Grande",
];
