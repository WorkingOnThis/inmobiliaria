type LedgerFlags = {
  impactaPropietario: boolean;
  incluirEnBaseComision: boolean;
  impactaCaja: boolean;
};

const FLAGS: Record<string, LedgerFlags> = {
  alquiler:      { impactaPropietario: true,  incluirEnBaseComision: true,  impactaCaja: true  },
  bonificacion:  { impactaPropietario: true,  incluirEnBaseComision: true,  impactaCaja: false },
  descuento:     { impactaPropietario: true,  incluirEnBaseComision: false, impactaCaja: false },
  // servicio: flags depend on tipoGestion — caller must override impactaCaja
  servicio:      { impactaPropietario: false, incluirEnBaseComision: false, impactaCaja: false },
  gasto:         { impactaPropietario: false, incluirEnBaseComision: false, impactaCaja: true  },
  punitorio:     { impactaPropietario: false, incluirEnBaseComision: false, impactaCaja: true  },
  deposito:      { impactaPropietario: false, incluirEnBaseComision: false, impactaCaja: true  },
  ajuste_indice: { impactaPropietario: false, incluirEnBaseComision: false, impactaCaja: false },
};

export function defaultFlagsForTipo(tipo: string): LedgerFlags {
  return FLAGS[tipo] ?? { impactaPropietario: true, incluirEnBaseComision: true, impactaCaja: false };
}
