/** Departamentos y distritos de San Juan, Argentina. */

export type SanJuanDepartment = {
  name: string;
  districts: string[];
};

export const SAN_JUAN_DEPARTMENTS: SanJuanDepartment[] = [
  {
    name: "Capital",
    districts: ["Centro", "Concepción", "Desamparados", "Trinidad", "Villa del Carmen", "Barrio Rawson", "Barrio Mitre"],
  },
  {
    name: "Rawson",
    districts: ["Villa Krause", "El Medanito", "Villa Barboza", "Colonia Fiorito", "Santa Clara"],
  },
  {
    name: "Rivadavia",
    districts: ["Rivadavia", "Marquesado", "La Bebida"],
  },
  {
    name: "Chimbas",
    districts: ["Villa Paula Albarracín de Sarmiento", "El Mogote", "Villa El Salvador"],
  },
  {
    name: "Santa Lucía",
    districts: ["Santa Lucía", "Alto de Sierra", "La Rinconada"],
  },
  {
    name: "Pocito",
    districts: ["Villa Aberastain", "La Rinconada", "Carpintería", "Quinto Cuartel", "La Legua"],
  },
  {
    name: "9 de Julio",
    districts: ["9 de Julio", "Las Chacritas"],
  },
  {
    name: "Albardón",
    districts: ["Villa General San Martín", "El Rincón", "La Cañada", "Campo Afuera"],
  },
  {
    name: "Angaco",
    districts: ["Villa El Salvador", "Punta del Monte", "Las Tapias"],
  },
  {
    name: "San Martín",
    districts: ["Villa San Martín", "San Isidro", "Dos Acequias"],
  },
  {
    name: "Caucete",
    districts: ["Caucete", "Bermejo", "Las Talas", "Pie de Palo", "El Rincón", "Marayes"],
  },
  {
    name: "25 de Mayo",
    districts: ["Villa Santa Rosa", "Tupelí", "Las Casuarinas", "El Encón", "La Chimbera"],
  },
  {
    name: "Sarmiento",
    districts: ["Media Agua", "Pedernal", "Cañada Honda", "Cochagual", "Colonia Fiscal", "Los Berros", "Punta del Médano"],
  },
  {
    name: "Ullum",
    districts: ["Villa Ibáñez"],
  },
  {
    name: "Zonda",
    districts: ["Villa Basilio Nievas", "Villa Tacú"],
  },
  {
    name: "Jáchal",
    districts: ["San José de Jáchal", "Niquivil", "Tamberías", "Villa Mercedes", "Pampa Vieja", "Huerta de Huachi", "Mogna"],
  },
  {
    name: "Iglesia",
    districts: ["Rodeo", "Iglesia", "Bella Vista", "Angualasto", "Las Flores", "Pismanta", "Tudcum"],
  },
  {
    name: "Calingasta",
    districts: ["Tamberías", "Barreal", "Calingasta"],
  },
  {
    name: "Valle Fértil",
    districts: ["San Agustín de Valle Fértil", "Astica", "Usno", "La Majadita"],
  },
];

export function composeGeography(department: string, district: string) {
  if (district && department) return `${district}, ${department}`;
  if (department) return `${department}, San Juan`;
  return "San Juan, Argentina";
}

export function districtsOf(department: string) {
  return SAN_JUAN_DEPARTMENTS.find((d) => d.name === department)?.districts ?? [];
}
