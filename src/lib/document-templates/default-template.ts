import { db } from "@/db";
import { documentTemplate, documentTemplateClause } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

const TEMPLATE_NAME = "Contrato de Locación — Modelo Arce";

// source values: "custom" (user-created) | "factory" (system-provided)

interface ClauseDef {
  title: string;
  body: string;
  order: number;
  category: string;
  isOptional: boolean;
}

const CLAUSES: ClauseDef[] = [
  {
    title: "Encabezado — Partes",
    order: 0,
    category: "partes",
    isOptional: false,
    body: `Entre [[apellido_locador]], [[nombres_locador]], DNI N° [[dni_locador]], en adelante denominada LA PARTE LOCADORA; y [[apellido_locatario]], [[nombres_locatario]], DNI N° [[dni_locatario]], con domicilio real en [[domicilio_locatario]], en adelante denominada LA PARTE LOCATARIA; convienen celebrar el presente contrato de locación sujeto a las siguientes cláusulas.`,
  },
  {
    title: "PRIMERA. INMUEBLE",
    order: 1,
    category: "propiedad",
    isOptional: false,
    body: `LA PARTE LOCADORA cede en locación el inmueble de su propiedad que LA PARTE LOCATARIA declara conocer y aceptar, por haberlo visitado con anterioridad, consistente en un [[tipo_inmueble]] ubicado en calle [[domicilio_propiedad_calle]] N° [[domicilio_propiedad_numero]][[if:domicilio_propiedad_unidad]], [[domicilio_propiedad_unidad]][[/if]], Barrio [[domicilio_propiedad_barrio]], Ciudad de [[domicilio_propiedad_ciudad]], Provincia de [[domicilio_propiedad_provincia]], con los siguientes ambientes: {{ambientes_descripcion}}.

ESTADO DEL INMUEBLE: LA PARTE LOCATARIA declara haber visitado y examinado el inmueble, como también acepta recibirlo en las condiciones descritas en la presente cláusula, recibiéndolo desocupado, en perfectas condiciones de uso e higiene y en excelente estado, teniendo el plazo de 30 días desde la entrega de llaves para presentar un descargo e inventario de las cosas que no condicen con esta cláusula. Asimismo, se obliga a mantener y restituir el inmueble en las mismas condiciones. El inmueble que se entrega consta de:

{{estado_living}}

{{estado_cocina}}

{{estado_bano}}

{{estado_dormitorio}}

{{estado_otros_ambientes}}

OBSERVACIONES: {{observaciones_estado}}

La reparación a cargo de LA PARTE LOCATARIA deberá realizarse dentro de los 5 días de producido el desperfecto, o en su defecto podrá hacerlo LA PARTE LOCADORA por cuenta de LA PARTE LOCATARIA, quien deberá satisfacer el importe de los gastos al momento de presentada la factura respectiva.`,
  },
  {
    title: "SEGUNDA. DESTINO",
    order: 2,
    category: "uso",
    isOptional: false,
    body: `LA PARTE LOCATARIA destinará el inmueble exclusivamente a VIVIENDA FAMILIAR, quedando terminantemente prohibido darle un destino diferente al precitado, salvo que se lo haya comunicado por escrito a LA PARTE LOCADORA y ésta lo autorice de manera fehaciente.

Queda expresamente prohibido el uso del mismo para fines comerciales de cualquier tipo. El incumplimiento de la presente cláusula será causal de desalojo por uso abusivo. Queda terminantemente prohibido tener en la propiedad mercadería o cosas que pudieran afectar la seguridad de las personas, objetos e instalaciones, ni realizar actos que contraríen las normas municipales, leyes provinciales y nacionales vigentes, que LA PARTE LOCATARIA declara conocer y cumplir.

Es a su cargo gestionar ante la Administración Pública, las respectivas autorizaciones y habilitaciones para el funcionamiento de las instalaciones de los servicios de gas, u otro servicio, con las consideraciones que se indican en el presente contrato.`,
  },
  {
    title: "TERCERA. DURACIÓN",
    order: 3,
    category: "contrato",
    isOptional: false,
    body: `El contrato se celebra por el plazo de {{duracion_letras}} ([[duracion_meses]] meses), desde el día [[fecha_inicio]] hasta el [[fecha_fin]]. Debiendo ese día LA PARTE LOCATARIA devolver las llaves de la propiedad, entregando el inmueble totalmente libre de ocupantes y/o cosas que de él dependan. La falta de cumplimiento por parte de LA PARTE LOCATARIA de la obligación de restituir el inmueble al vencimiento del plazo establecido no implicará de manera alguna reconducción locativa, nuevo contrato o prórroga alguna, subsistiendo mientras dure la ocupación ilegítima la obligación de pago del alquiler por el mes entero, con la aplicación automática además de una penalidad consistente en el pago de la suma equivalente al 10% (diez por ciento) del canon locativo por cada día que demore la restitución del bien locado, sin perjuicio del derecho de LA PARTE LOCADORA de promover la pertinente acción de desalojo por vencimiento del término contractual, con más los daños y perjuicios que pudiesen existir.`,
  },
  {
    title: "CUARTA. PRECIO",
    order: 4,
    category: "contrato",
    isOptional: false,
    body: `Por la locación, las partes convienen un precio locativo de [[precio_inicial_letras]] ([[precio_inicial_formato]]) por mes por el primer trimestre, con más las demás obligaciones que conforman el canon locativo mencionadas en el presente contrato.`,
  },
  {
    title: "QUINTA. AJUSTE",
    order: 5,
    category: "contrato",
    isOptional: false,
    body: `Transcurridos los primeros [[periodo_ajuste_meses]] meses, el canon mensual definido en la cláusula anterior se actualizará de forma trimestral y acumulativa. El precio del alquiler se pacta por períodos enteros y si LA PARTE LOCATARIA desocupara la propiedad antes del fin de mes, lo deberá abonar íntegramente.

Para la realización del ajuste del monto del alquiler se utilizará el [[tipo_ajuste]] publicado por el organismo oficial correspondiente.`,
  },
  {
    title: "SEXTA. FORMA DE PAGO",
    order: 6,
    category: "pago",
    isOptional: false,
    body: `El alquiler mensual se pacta por períodos enteros, será abonado por adelantado y en efectivo el primer día de cada mes; otorgándole hasta el [[dia_gracia]] de cada mes la gracia de hacerlo sin recargo alguno, siempre y cuando no adeudare obligación alguna emergente del presente contrato. Déjese pactado que, si el último día del plazo establecido para el pago fuera inhábil, éste vencerá el día hábil inmediato posterior, a partir del cual se producirá la mora.

PAGOS ELECTRÓNICOS U OTROS: En el caso de que LA PARTE LOCATARIA utilizare sistemas de pago por cualquier método electrónico y/o transferencias bancarias, deberá abonar al administrador del inmueble una comisión del [[porcentaje_comision_pago_electronico]]% sobre la suma abonada. Este porcentaje será retenido al momento de efectuarse dicho pago. Los comprobantes de pago deberán ser enviados antes del día [[dia_gracia]] de cada mes (o el día hábil siguiente en caso de corresponder) al domicilio electrónico establecido por LA PARTE LOCADORA (WhatsApp y correo electrónico).

De suscitarse que el pago por transferencia no cubra el importe devengado a la fecha en que se realizare, el pago se tomará como pago parcial y devengará intereses hasta completar el monto total adeudado.

Se deja especificado que los intereses por mora continuarán corriendo hasta tanto NO SE ACREDITEN DEBIDAMENTE todos los rubros integrativos del canon locativo, esto es, alquiler puro, más impuestos y servicios.`,
  },
  {
    title: "SÉPTIMA. LUGAR DE PAGO",
    order: 7,
    category: "pago",
    isOptional: false,
    body: `El domicilio de pago se fija en [[domicilio_administradora]], o en el domicilio que indique en un futuro LA PARTE LOCADORA a LA PARTE LOCATARIA.

LA PARTE LOCADORA autoriza a [[nombre_administradora]] y/o a la persona que ella designe a percibir los pagos de las obligaciones emergentes del presente contrato, extender recibos, inspeccionar y recepcionar la propiedad en su oportunidad, convenir rescisión y/o aceptación por término vencido, y realizar todo tipo de gestiones tendientes a lograr el cumplimiento del contrato, incluyendo las intimaciones necesarias, comprendida la exigida por el Art. 1222 del Código Civil y Comercial de la Nación.

Se deja expresamente aclarado que en el supuesto de modificarse el lugar de pago del canon locativo, LA PARTE LOCADORA comunicará de manera fehaciente dicho cambio a LA PARTE LOCATARIA.

LA PARTE LOCATARIA deberá acreditar el pago de los alquileres mediante el envío del comprobante de transferencia al número de WhatsApp y al correo electrónico constituidos por LA PARTE LOCADORA en el presente contrato. En caso de no acreditarse el pago en debido tiempo y forma, continuarán corriendo los intereses por mora hasta tanto se acredite fehacientemente el cumplimiento de la obligación. Conjuntamente con dicho comprobante, LA PARTE LOCATARIA deberá remitir también los comprobantes de pago de los impuestos y servicios que sean a su cargo en virtud del presente contrato.`,
  },
  {
    title: "OCTAVA. INTRANSFERIBILIDAD",
    order: 8,
    category: "restricciones",
    isOptional: false,
    body: `LA PARTE LOCATARIA no podrá sub-alquilar, permutar, prestar, ceder en todo o en parte el inmueble que por este acto se alquila, ni transferir los efectos del presente contrato sin previo consentimiento expreso de LA PARTE LOCADORA o su representante. Siendo cualquiera de las mencionadas causal de resolución contractual por exclusiva culpa de LA PARTE LOCATARIA, dando lugar a la correspondiente acción de desalojo.`,
  },
  {
    title: "NOVENA. MORA",
    order: 9,
    category: "pago",
    isOptional: false,
    body: `La falta de pago del precio locativo en el lugar y fecha establecidos hará incurrir en mora a LA PARTE LOCATARIA de pleno derecho y sin necesidad de interpelación judicial ni extrajudicial alguna, conforme al art. 886 del Código Civil y Comercial de la Nación. Desde el día primero de cada mes y hasta el efectivo pago, LA PARTE LOCATARIA adeudará sobre el monto locativo impago un interés punitorio del [[porcentaje_interes_mora]]% (sin aplicación de bonificación alguna) por cada día de mora. Dicho porcentaje incluirá el IVA correspondiente en caso de que LA PARTE LOCADORA revista la calidad de responsable inscripta ante AFIP. Las partes declaran haber pactado esta tasa en forma libre y voluntaria, reconociéndola como compensación razonable por los daños derivados del incumplimiento.

La falta de pago del precio locativo en tiempo y forma, o el incumplimiento de cualquier otra obligación emergente del presente contrato por parte de LA PARTE LOCATARIA, otorgará derecho a LA PARTE LOCADORA a iniciar de inmediato las acciones judiciales de desalojo del inmueble locado conforme a la normativa procesal aplicable, siendo dicho incumplimiento causa suficiente de rescisión contractual. LA PARTE LOCATARIA y los garantes solidarios prestan su consentimiento expreso para que, verificada la causa de incumplimiento y/o rescisión, LA PARTE LOCADORA proceda a informar la situación ante los registros de antecedentes crediticios habilitados (tales como Nosis, Veraz u otros).

A los efectos de tener por cumplida la obligación de pago, LA PARTE LOCATARIA deberá acreditar en forma conjunta: a) el pago del canon locativo con todos sus accesorios; y b) el pago de los impuestos y servicios que se encuentren a su cargo en virtud del presente contrato. No se considerará íntegramente abonado el canon locativo si faltare alguno de dichos rubros, quedando habilitada LA PARTE LOCADORA a rechazar el pago parcial conforme al art. 869 del Código Civil y Comercial de la Nación.

LA PARTE LOCADORA podrá negarse a recibir cualquier pago parcial sin que ello implique renuncia a su derecho a reclamar la totalidad de lo adeudado más la penalidad pactada, al amparo del art. 869 del Código Civil y Comercial de la Nación. Asimismo, los gastos administrativos y de gestión de cobranza que se originen por causa del incumplimiento de LA PARTE LOCATARIA serán a exclusivo cargo de esta última.`,
  },
  {
    title: "DÉCIMA. OBLIGACIONES",
    order: 10,
    category: "obligaciones",
    isOptional: false,
    body: `LA PARTE LOCATARIA está obligada a: 1) Permitir la entrada de LA PARTE LOCADORA o su representante a la propiedad, previo aviso con 24 hs. de anticipación, las veces que lo crea necesario, ya sea para inspeccionar la misma o para realizar algún trabajo; 2) Cargar con los gastos de reparación del inmueble en caso de incendio, explosión y cualquier otro daño, cuando la causa del hecho hubiere sido provocada por motivos culposos a él imputables; 3) Abonar las costas, gastos judiciales y extrajudiciales a que dé lugar el incumplimiento del presente contrato; 4) Respetar las ordenanzas y reglamentaciones de cualquier jurisdicción que gobierne al edificio, cargando con las infracciones a las mismas; 5) No faltar ni permitir faltar a las personas que concurran al inmueble, a la moral y las buenas costumbres; 6) Conservar el inmueble locado en el mismo estado que lo recibió, durante todo el tiempo que lo ocupe; 7) Entregar el inmueble al término del contrato en las mismas buenas condiciones en que lo recibe.

Reparaciones urgentes: entiéndase por aquellas que por su gravedad pueden ocasionar daños o implicar un riesgo cierto y concreto para las personas o los bienes, y que se deriven de desperfectos o problemas edilicios y que no sean producto de uso indebido por parte de LA PARTE LOCATARIA. LA PARTE LOCATARIA deberá notificar fehacientemente a LA PARTE LOCADORA o su representante, y frente a su silencio, podrá LA PARTE LOCATARIA realizar dichas reparaciones por sí y a cargo de LA PARTE LOCADORA, una vez transcurridas veinticuatro (24) horas corridas desde la recepción de la notificación. Para que el costo sea asumido por LA PARTE LOCADORA, deberá presentar factura o recibo oficial de técnico matriculado o comercio habilitado, y foto de los daños.

Reparaciones NO urgentes: LA PARTE LOCATARIA debe intimar al locador para que realice las mismas, dentro de un plazo no inferior a diez (10) días corridos desde la recepción de la intimación. Si el locador no realizara las reparaciones en el plazo previsto, el locatario podrá realizarlas por sí, procediendo de la manera descripta en el apartado anterior.

El incumplimiento por parte de LA PARTE LOCATARIA a cualquiera de estos puntos dará derecho a LA PARTE LOCADORA a dar por resuelta automáticamente esta locación y en consecuencia, pedir el desalojo inmediato con más indemnización por daños y perjuicios.`,
  },
  {
    title: "DÉCIMO PRIMERA. RESPONSABILIDAD DEL LOCADOR",
    order: 11,
    category: "responsabilidad",
    isOptional: false,
    body: `LA PARTE LOCADORA no se responsabiliza por accidentes, casos fortuitos, incendios, inundaciones o cualquier otro siniestro en los bienes o pertenencias de LA PARTE LOCATARIA, ni en los muebles u objetos introducidos en el inmueble por ésta. Se sugiere a LA PARTE LOCATARIA mantener en vigencia una cobertura de seguro de responsabilidad civil, incendio y destrucción total que proteja la reparación de los daños indicados en el presente y daños contra terceros de todo tipo. En caso de que LA PARTE LOCATARIA no contrate una póliza de seguro de inmueble en el plazo de 30 (treinta) días de suscripto el presente, LA PARTE LOCADORA puede proceder a contratar el mismo y cobrar dicho rubro junto con el canon locativo.`,
  },
  {
    title: "DÉCIMO SEGUNDA. MEJORAS",
    order: 12,
    category: "restricciones",
    isOptional: false,
    body: `LA PARTE LOCATARIA no podrá efectuar en el inmueble ninguna alteración o innovación en la construcción sin previo consentimiento expreso de LA PARTE LOCADORA o su representante; caso contrario ésta podrá ordenar la demolición o reconstrucción a costa de LA PARTE LOCATARIA, no teniendo ésta derecho a reclamo o indemnización de ninguna índole. En caso de realizarse mejoras, aún sin autorización, las mismas quedarán en beneficio del inmueble a partir del momento de su realización, pudiendo LA PARTE LOCADORA, si lo estima conveniente, exigir la demolición o reconstrucción a costa de LA PARTE LOCATARIA.`,
  },
  {
    title: "DÉCIMO TERCERA. IMPUESTOS Y SERVICIOS",
    order: 13,
    category: "servicios",
    isOptional: false,
    body: `Son a cargo de LA PARTE LOCATARIA, como parte integrante del canon locativo, durante todo el período de locación y hasta la efectiva restitución del inmueble: a) Impuesto provincial sobre el inmueble (DGR-CBA); b) Contribución Inmobiliaria Municipal de la Ciudad de Córdoba; c) Servicio de agua potable, sus reajustes y adicionales; d) Contribuciones por mejoras extraordinarias presentes y futuras que se hagan exigibles durante la vigencia del contrato; e) Servicio de energía eléctrica; f) Servicio de gas natural; g) Telefonía, cable e internet.

LA PARTE LOCATARIA deberá gestionar a su exclusivo costo y cargo la contratación o el cambio de titularidad de todos los servicios enumerados precedentemente ante las empresas proveedoras correspondientes, dentro de los quince (15) días corridos desde la firma del presente contrato. El incumplimiento de esta obligación dentro del plazo establecido será causal suficiente para iniciar las acciones judiciales de desalojo.

Todos los gastos que las empresas proveedoras exijan para el normal funcionamiento de los servicios en el inmueble serán a exclusivo cargo de LA PARTE LOCATARIA.

De ninguna manera podrá LA PARTE LOCATARIA alegar como eximente del pago la falta de recepción de aviso, factura, cedulón o notificación alguna de los organismos o empresas prestadoras.

Al vencimiento del contrato o ante cualquier supuesto de restitución anticipada del inmueble, LA PARTE LOCATARIA deberá: a) Presentar certificado de libre deuda expedido por los entes prestadores de los servicios de agua, energía eléctrica y gas natural; b) Acreditar la baja o transferencia de los servicios de telefonía, cable e internet.

LA PARTE LOCADORA y/o su administrador se reservan el derecho de no receptar el canon locativo en caso de que LA PARTE LOCATARIA no hubiere abonado la totalidad de los conceptos establecidos en la presente cláusula.`,
  },
  {
    title: "DÉCIMO CUARTA. EXPENSAS COMUNES",
    order: 14,
    category: "servicios",
    isOptional: false,
    body: `Al momento de la celebración del presente contrato, el inmueble locado no se encuentra sometido a reglamento de copropiedad, por lo cual no existe obligación de pago de expensas comunes. No obstante, si durante la vigencia del contrato o sus prórrogas el inmueble quedare sometido a régimen de propiedad horizontal o condominio con reglamento de copropiedad, las expensas comunes ordinarias que se devenguen a partir de ese momento serán a exclusivo cargo de LA PARTE LOCATARIA, quien deberá acreditarlas mensualmente del 1 al 10 de cada mes. En tal caso, y al momento de la restitución del inmueble, LA PARTE LOCATARIA deberá presentar certificado de libre deuda de expensas ante LA PARTE LOCADORA o su administrador. Las expensas extraordinarias serán a cargo de LA PARTE LOCADORA, salvo pacto en contrario instrumentado por escrito.`,
  },
  {
    title: "DÉCIMO QUINTA. CONFORMACIÓN DEL PRECIO",
    order: 15,
    category: "pago",
    isOptional: false,
    body: `Forma parte integrante del precio pactado y por ende a cargo y costo de LA PARTE LOCATARIA, los conceptos convenidos en las cláusulas cuarta, decimotercero y los siguientes conceptos: A) Honorarios y gastos por gestión de cobranza de cualquier monto adeudado; B) Honorarios/Comisiones y gastos derivados por confección de contrato; C) Gastos de reparación y/o mantenimiento del Inmueble; D) Servicios de electricidad, Gas, Internet, Telefonía, ó cualquier otro concepto que impongan las Empresas proveedoras de servicios; E) Honorarios y gastos derivados por finalización de contrato por cualquier causal imputable a cualquier parte; F) Alquileres puros según monto de cláusula cuarta; G) Los intereses que generen todos los conceptos integrantes del precio o canon locativo, desde que sean exigibles, estipulado como mínimo de común acuerdo en el [[porcentaje_interes_mora]]% diario más IVA en caso de corresponder, sobre el monto adeudado, salvo que el ente o persona pública o privada que los imponga establezca uno mayor, en cuyo caso será éste último.

Todo lo ut supra mencionado en la presente cláusula conforma el "PRECIO O CANON LOCATIVO".

Para el caso de que algún concepto del precio locativo deba ser acreditado con comprobantes pagados, y ya se hubiese devengado o vencido la obligación de pagarlo ante el ente o persona que lo impuso sin que LA PARTE LOCATARIA lo acreditara en el domicilio de pago, éste acepta y declara que el Locador tiene derecho a cobrarle dichos montos que verifique por cualquier medio.`,
  },
  {
    title: "DÉCIMO SEXTA. IMPUTACIÓN DE PAGOS",
    order: 16,
    category: "pago",
    isOptional: false,
    body: `En el caso de que LA PARTE LOCATARIA adeudara cualquiera de los conceptos mencionados en la cláusula anterior, éste acepta que toda suma que abonase, se imputará primero al pago de sus intereses cualquiera fuere y de cualquier concepto surgido de contractual o extracontractual, y luego al sólo criterio del Locador en el orden que lo crea conveniente sobre los capitales adeudados; pudiendo a su vez, y reservándose el derecho de negarse LA PARTE LOCADORA a recibir pagos parciales, conviniéndose entre las partes que se utilizará en todos los casos de mora, la vía ejecutiva a los efectos de reclamar el precio convenido o cualquiera de los conceptos parciales que lo componen.

LA PARTE LOCATARIA declara y acepta que de adeudar algún concepto descripto en la presente cláusula, NO realizará consignación judicial probando que intenta pagar el precio puro de alquiler por el uso y goce, renunciando a ese derecho por ser un pago parcial del canon locativo.`,
  },
  {
    title: "DÉCIMO SÉPTIMA. CEDULONES",
    order: 17,
    category: "servicios",
    isOptional: false,
    body: `LA PARTE LOCATARIA está obligada a reclamar a todas las empresas de servicios en caso de no recibirlos la remisión de los cedulones de pago, abonándole en los plazos de vencimiento y hasta la fecha de desocupación total del inmueble, bajo apercibimiento de considerarse que el incumplimiento de pago de cualquiera de esos importes autorizará a LA PARTE LOCADORA a no recibir el valor del alquiler si no se acredita haberlos abonado o a imputar las sumas abonadas al pago de deudas por dichos conceptos. Los originales de dichos pagos se irán entregando a LA PARTE LOCADORA o la Administradora al momento del pago de los alquileres.

De ninguna manera podrá alegar LA PARTE LOCATARIA que no abona tales conceptos a su cargo por no haber recibido aviso, cedulón, etc., de los organismos pertinentes; la diligencia para su oportuno pago es a su exclusivo cargo.`,
  },
  {
    title: "DÉCIMO OCTAVA. GARANTES",
    order: 18,
    category: "garantes",
    isOptional: false,
    body: `Los Sres.: 1) [[apellido_fiador_1]], [[nombres_fiador_1]], D.N.I. N° [[dni_fiador_1]], con domicilio en [[domicilio_fiador_1]], correo electrónico [[email_fiador_1]], teléfono [[telefono_fiador_1]]; 2) [[apellido_fiador_2]], [[nombres_fiador_2]], D.N.I. N° [[dni_fiador_2]], con domicilio en [[domicilio_fiador_2]], correo electrónico [[email_fiador_2]], teléfono [[telefono_fiador_2]]; 3) [[apellido_fiador_3]], [[nombres_fiador_3]], D.N.I. N° [[dni_fiador_3]], con domicilio en [[domicilio_fiador_3]], correo electrónico [[email_fiador_3]], teléfono [[telefono_fiador_3]]; se constituyen en codeudores solidarios, lisos, llanos y principales pagadores de todas las obligaciones emergentes del presente contrato, inclusive las costas judiciales y/o extrajudiciales, renunciando desde ya a los beneficios de excusión, interpelación, aviso previo y los demás que las leyes acuerdan a fiadores hasta tanto el inmueble sea entregado al propietario desocupado, sin deudas de ninguna naturaleza y en las condiciones convenidas.

La fianza se extenderá hasta que queden absolutamente cumplidas todas las obligaciones asumidas por el locatario en este contrato, aunque fuesen posteriores al vencimiento del término de la locación o a la desocupación del inmueble por parte del locatario. LA PARTE LOCADORA se reserva el derecho a exigir el reemplazo de los fiadores en caso de insolvencia, fallecimiento o desaparición, obligándose LA PARTE LOCATARIA en el plazo de 5 días hábiles a presentar un nuevo garante-fiador.

Los garantes propietarios [[apellido_fiador_1]], [[nombres_fiador_1]], y [[apellido_fiador_2]], [[nombres_fiador_2]], renuncian en forma expresa e irrevocable al beneficio de inembargabilidad y al de bien de familia respecto de los inmuebles de su propiedad inscriptos en el Registro General de la Propiedad Inmueble de la Provincia de Córdoba: a) Matrícula N° [[matricula_inmueble_garantia]], Nomenclatura Catastral [[catastro_inmueble_garantia]], con domicilio en [[domicilio_inmueble_garantia]]; b) Matrícula N° {{matricula_garantia_2}}, Nomenclatura Catastral {{catastro_garantia_2}}, con domicilio en {{domicilio_garantia_2}}; inmuebles que LA PARTE LOCADORA acepta en garantía. Manifiestan bajo juramento que dichos bienes no constituyen vivienda familiar y representan una inversión patrimonial.`,
  },
  {
    title: "DÉCIMO NOVENA. RESCISIÓN ANTICIPADA",
    order: 19,
    category: "rescision",
    isOptional: false,
    body: `LA PARTE LOCATARIA podrá ejercer la rescisión anticipada, siempre que se ajuste a la norma legal, debiendo notificar en forma fehaciente su decisión. Deberá consignar en la notificación la fecha en que el inmueble quedará libre de personas y cosas. Cualquier otro medio utilizado no será válido a los fines de la rescisión. En tal caso, deberá abonar a LA PARTE LOCADORA el equivalente al 10% (diez por ciento) del canon locativo futuro, calculado desde la fecha de la notificación de la rescisión hasta la fecha de finalización pactada en el contrato. Conforme Art. 1221 CCCN.`,
  },
  {
    title: "VIGÉSIMA. RENOVACIÓN DEL CONTRATO",
    order: 20,
    category: "contrato",
    isOptional: false,
    body: `Cualquiera de las partes podrá convocar a la otra, dentro del último mes del contrato de locación, notificándola de forma fehaciente en los domicilios denunciados en la cláusula Vigésima Tercera, a efectos de acordar la renovación del contrato, en un plazo no mayor a quince (15) días corridos.`,
  },
  {
    title: "VIGÉSIMO PRIMERA. RESOLUCIÓN Y/O RESCISIÓN CULPABLE",
    order: 21,
    category: "rescision",
    isOptional: false,
    body: `Procederá el desalojo en todos los casos de resolución y/o rescisión culpable, y por las otras causales de incumplimiento de las obligaciones estipuladas en el presente contrato, para lo cual el contrato de locación quedará resuelto por el solo incumplimiento de las obligaciones pactadas en este contrato y/o supletorias del Código Civil y Comercial. La notificación de la demanda de desalojo importará el aviso resolutorio expreso, que convertirá ipso iure en resuelto el respectivo contrato. Juntamente con la acción de desalojo se podrá acumular la de daños y perjuicios por tales incumplimientos. En caso de consignación de llaves en juicio, el alquiler será exigible hasta que LA PARTE LOCADORA retome la tenencia real y efectiva de la propiedad.`,
  },
  {
    title: "VIGÉSIMO SEGUNDA. RESTITUCIÓN",
    order: 22,
    category: "restitución",
    isOptional: false,
    body: `Al vencimiento del presente contrato, LA PARTE LOCATARIA deberá restituir el inmueble locado libre de personas, muebles, objetos pertenecientes a LA PARTE LOCADORA y/o a terceros. LA PARTE LOCATARIA se obliga a mantenerlo y restituirlo sin pintar. Sin embargo, es su obligación el costo que demande su pintado, tanto de aberturas como paredes. Deberá por lo tanto pagar el costo de los materiales (látex interior y exterior, sintético para aberturas de Pintura Sherwin Williams o similar, más rodillos, pinceles y lijas) de acuerdo al precio de plaza del momento de la devolución, y el costo de la mano de obra de un profesional idóneo designado exclusivamente por el Locador.

En particular, LA PARTE LOCATARIA deberá presentar certificación emitida por un gasista matriculado que acredite el buen funcionamiento, estanqueidad y seguridad del calefón y los calefactores. Dicha certificación deberá tener fecha no mayor a quince (15) días anteriores a la restitución del inmueble.

Si al momento de la restitución del inmueble, existen períodos de servicios a cargo de LA PARTE LOCATARIA que aún no hubiesen sido facturados por los entes prestadores, se le exigirá a LA PARTE LOCATARIA en concepto de garantía el monto equivalente al último periodo devengado del servicio correspondiente.

No restituyendo el inmueble al vencimiento del contrato, LA PARTE LOCATARIA quedará automáticamente constituido en mora y deberá abonar una multa equivalente al 10% (diez por ciento) del canon locativo por cada día que demore la desocupación.

Con diez días de anticipación al vencimiento del contrato, LA PARTE LOCATARIA deberá dar aviso por medio fehaciente de la hora y día en que hará efectiva la restitución, debiéndose pactar el mismo de lunes a viernes en el horario de 9 a 17 hs. Solamente se considerará concluida la locación con la acreditación de un recibo emitido por LA PARTE LOCADORA o la ADMINISTRADORA en el que conste expresamente la aceptación del estado y el libre deuda de impuestos y servicios correspondientes.

Asimismo, LA PARTE LOCATARIA deberá presentar libre de deuda de gas y luz, expedida por los respectivos prestadores. La entrega de llaves de la propiedad deberá justificarse por LA PARTE LOCATARIA con documento escrito, no admitiéndose otro medio de prueba.`,
  },
  {
    title: "VIGÉSIMO TERCERA. DOMICILIOS",
    order: 23,
    category: "partes",
    isOptional: false,
    body: `Las partes establecen los siguientes domicilios para todas las comunicaciones, efectos legales y todo lo atinente al presente contrato:

a. PARTE LOCADORA: en [[domicilio_locador]]. Domicilio electrónico: [[email_locador]] Teléfono: [[telefono_locador]].

b. PARTE LOCATARIA: en calle [[domicilio_propiedad_calle]] N° [[domicilio_propiedad_numero]][[if:domicilio_propiedad_unidad]], [[domicilio_propiedad_unidad]][[/if]], [[domicilio_propiedad_barrio]], Ciudad de [[domicilio_propiedad_ciudad]]. Domicilio electrónico: [[email_locatario]] Teléfono: [[telefono_locatario]].

c. GARANTES: 1) [[apellido_fiador_1]], [[nombres_fiador_1]] DOMICILIO: [[domicilio_fiador_1]], Domicilio electrónico: [[email_fiador_1]] Teléfono: [[telefono_fiador_1]] 2) [[apellido_fiador_2]], [[nombres_fiador_2]] DOMICILIO: [[domicilio_fiador_2]], Domicilio electrónico: [[email_fiador_2]], Teléfono: [[telefono_fiador_2]] 3) [[apellido_fiador_3]], [[nombres_fiador_3]] DOMICILIO: [[domicilio_fiador_3]], Domicilio electrónico: [[email_fiador_3]], Teléfono: [[telefono_fiador_3]].

En el cual se tendrán por válidas y vinculantes las notificaciones que se cursaren al mismo, siendo plenamente eficaces todos los emplazamientos y/o comunicaciones que allí se practiquen, conforme el Art. 75 del Código Civil y Comercial.

LA PARTE LOCADORA O LOCATARIA, podrán modificar los domicilios constituidos, pero lo deberán notificar en forma fehaciente.`,
  },
  {
    title: "VIGÉSIMO CUARTA. COMPENSACIÓN",
    order: 24,
    category: "pago",
    isOptional: false,
    body: `Si LA PARTE LOCATARIA ejerciera la compensación de los gastos y acreencias que estén a cargo de LA PARTE LOCADORA, de lo debido en concepto de cánones locativos, para que la misma sea válida deberá notificar fehacientemente a LA PARTE LOCADORA con detalle de los mismos. Sin perjuicio de ello, a los fines de reglamentar entre las partes el ejercicio de su derecho, las partes establecen que solo será válida la compensación si se procedió conforme a lo estipulado en la cláusula DÉCIMA.`,
  },
  {
    title: "VIGÉSIMO QUINTA. JUICIO EJECUTIVO",
    order: 25,
    category: "legal",
    isOptional: false,
    body: `Los créditos por alquileres serán pasibles de ser perseguidos judicialmente por la vía de Juicio Ejecutivo según lo establece el Código de Procedimientos de la Provincia de Córdoba.`,
  },
  {
    title: "VIGÉSIMO SEXTA. ACTOS EXCLUSIVAMENTE ESCRITOS",
    order: 26,
    category: "legal",
    isOptional: false,
    body: `Las partes declaran y se obligan en forma definitiva e irrevocable y como condición indispensable de esta locación, que todos los actos entre ellas, únicamente se perfeccionarán por escrito y ninguno en forma oral o verbal, de palabra o de hecho, vedando en especial cualquier prórroga y/o nuevos contratos sobre el inmueble locado, fuera de los escritos y firmados por las partes obligadas. Si el LOCATARIO pretendiese quedarse en el inmueble locado invocando "locación verbal, de palabra o de hecho" prohibida en esta cláusula, pagará como CLAUSULA PENAL el equivalente a TRES (3) MESES del último precio de la locación vigente en efectivo, además de las otras obligaciones asumidas en el presente contrato.`,
  },
  {
    title: "VIGÉSIMO SÉPTIMA. JURISDICCIÓN Y COMPETENCIA",
    order: 27,
    category: "legal",
    isOptional: false,
    body: `Para todos los efectos legales tanto los Contratantes y/o Fiadores de este contrato renuncian expresamente al Fuero Federal en caso de corresponderles, sometiéndose para cualquier cuestión derivada del presente, a la Jurisdicción y Competencia de los Tribunales Ordinarios de la ciudad de [[domicilio_propiedad_ciudad]], Provincia de [[domicilio_propiedad_provincia]]. Las partes también declinan el derecho procesal de "recusación sin expresión de causa" (Art. 19 del C.P.C.C.) del juez que deba entender en caso de litigio.`,
  },
  {
    title: "VIGÉSIMO OCTAVA. IMPUESTO A LOS SELLOS",
    order: 28,
    category: "legal",
    isOptional: false,
    body: `Los sellos, aforos, informes registrales y personales, certificaciones notariales y los honorarios por apertura de carpeta y la redacción y/o confección correspondientes al presente contrato serán abonados en su totalidad por LA PARTE LOCATARIA al momento de la firma del presente.`,
  },
  {
    title: "VIGÉSIMO NOVENA. ABANDONO Y MUERTE DE LA PARTE LOCATARIA",
    order: 29,
    category: "legal",
    isOptional: false,
    body: `Queda acordado para el caso de abandono manifiesto LA PARTE LOCADORA podrá ingresar directamente en la unidad locada con funcionario público (escribano u oficial de justicia), tomar razón del bien y continuar con la tenencia del mismo. Para el caso de muerte de LA PARTE LOCATARIA, los herederos y personas comprendidas en el Art. 1189 y 1190 del Código Civil y Comercial, deberán notificar en forma fehaciente si aceptan o no la continuación de la locación, en forma expresa y por escrito, debiéndose realizar acuerdo anexo al presente. En caso de no optar por la continuación, en el plazo de 15 días corridos de producido el deceso, se dará por rescindido el presente.`,
  },
  {
    title: "TRIGÉSIMA. ENTREGA DE LLAVES",
    order: 30,
    category: "propiedad",
    isOptional: false,
    body: `En este mismo acto, se hace entrega de las llaves, recibiendo LA PARTE LOCATARIA en conformidad y debiendo efectuar el cambio de combinación de las mismas, a partir del día de la fecha, siendo responsable de su inobservancia.`,
  },
  {
    title: "TRIGÉSIMO PRIMERA. DEUDORES MOROSOS",
    order: 31,
    category: "mora",
    isOptional: false,
    body: `En caso de falta de pago de dos (2) períodos consecutivos de la locación, el locatario y garantes solidarios autorizan a LA PARTE LOCADORA a publicar sus datos personales en las bases de datos de "DEUDORES MOROSOS" de instituciones o empresas, que emitan informes crediticios de situación financiera, como por ejemplo las empresas SEVEN y VERAZ, conforme a la ley Nº 25.326.`,
  },
  {
    title: "TRIGÉSIMO SEGUNDA. DEPÓSITO EN GARANTÍA",
    order: 32,
    category: "garantia",
    isOptional: false,
    body: `LA PARTE LOCATARIA se compromete a abonar a LA PARTE LOCADORA, con carácter previo al ingreso al inmueble y como condición suspensiva para la entrega de llaves, la suma equivalente a UN (1) MES del canon locativo inicial pactado en la cláusula CUARTA, esto es, la suma de [[precio_inicial_letras]] ([[precio_inicial_formato]]), o su equivalente en dólares estadounidenses billete si así lo acordaren las partes al momento del pago. LA PARTE LOCADORA emitirá el recibo correspondiente al momento de percibir dicho depósito.

El depósito tiene por objeto garantizar el cumplimiento de las obligaciones asumidas por LA PARTE LOCATARIA en el presente contrato, en particular el pago del canon locativo, impuestos, servicios, expensas, reparaciones a su cargo y cualquier otro concepto integrante del canon locativo.

La restitución del depósito a LA PARTE LOCATARIA se efectuará al finalizar la locación, una vez cumplidas en forma conjunta las siguientes condiciones: a) entrega efectiva del inmueble en las condiciones previstas en la cláusula de RESTITUCIÓN; b) emisión del recibo de entrega de llaves en conformidad; y c) cancelación total de cualquier deuda emergente del presente contrato.

Forma de restitución: En caso de que el depósito hubiere sido entregado en pesos argentinos, LA PARTE LOCADORA lo restituirá actualizado al valor equivalente al último canon locativo efectivamente abonado por LA PARTE LOCATARIA durante la vigencia del contrato. En caso de que el depósito hubiere sido entregado en dólares estadounidenses billete, LA PARTE LOCADORA lo restituirá en la misma cantidad y moneda sin aplicación de ajuste alguno.

El depósito en garantía no podrá ser imputado al pago del último mes de alquiler ni a ningún otro período locativo durante la vigencia del contrato.`,
  },
  {
    title: "TRIGÉSIMO TERCERA. SIN ANEXOS",
    order: 33,
    category: "cierre",
    isOptional: false,
    body: `Las partes declaran bajo juramento que no hay anexo alguno al presente contrato, y que NO existen otros anexos, fotografías, documentación o pagarés que conformen el mismo.

En prueba de conformidad y habiéndose cada parte hecho asesorar por profesional del Derecho, previa lectura y ratificación, se firman tres ejemplares de un mismo tenor y a un mismo efecto, en la ciudad de [[domicilio_propiedad_ciudad]] a los {{dia_firma}} días del mes de {{mes_firma}} del año {{anio_firma}}.`,
  },
];

export async function ensureDefaultTemplate(agencyId: string): Promise<void> {
  const existing = await db
    .select({ id: documentTemplate.id })
    .from(documentTemplate)
    .where(
      and(
        eq(documentTemplate.agencyId, agencyId),
        eq(documentTemplate.source, "factory")
      )
    )
    .limit(1);

  if (existing.length > 0) return;

  await db.transaction(async (tx) => {
    const templateId = randomUUID();

    await tx.insert(documentTemplate).values({
      id: templateId,
      agencyId,
      name: TEMPLATE_NAME,
      source: "factory",
    });

    for (const clause of CLAUSES) {
      await tx.insert(documentTemplateClause).values({
        id: randomUUID(),
        templateId,
        title: clause.title,
        body: clause.body,
        order: clause.order,
        category: clause.category,
        isOptional: clause.isOptional,
        isActive: true,
        notes: "",
      });
    }
  });
}
