export type LegalDocKey = 'privacy' | 'terms'

export interface LegalSection {
  title: string
  paragraphs: string[]
}

export interface LegalDocument {
  title: string
  updated: string
  sections: LegalSection[]
}

const UPDATED = 'Octubre de 2026'

export const legalDocuments: Record<LegalDocKey, LegalDocument> = {
  privacy: {
    title: 'Política de privacidad',
    updated: UPDATED,
    sections: [
      {
        title: '1. Responsable de la aplicación',
        paragraphs: [
          'LifeKeeper es una aplicación personal de organización de información. El responsable del proyecto es Daniel Diaz. Podés comunicarte por los canales de contacto que se indiquen en la aplicación.',
        ],
      },
      {
        title: '2. Qué información almacena',
        paragraphs: [
          'La aplicación guarda únicamente la información que vos ingresás: datos de perfil, registros de salud, notas del diario, credenciales del gestor de contraseñas, documentos, movimientos de finanzas, proyectos, vehículos y recordatorios.',
          'No se recolectan datos de navegación, analíticas, publicidad ni información de terceros de forma automática.',
        ],
      },
      {
        title: '3. Dónde se guardan tus datos',
        paragraphs: [
          'Toda la información permanece en este dispositivo, en el almacenamiento local del navegador, cifrada con AES utilizando tu contraseña maestra como clave.',
          'LifeKeeper no envía tus datos a servidores propios ni a servicios de terceros. Las exportaciones y los respaldos que generás quedan bajo tu control.',
        ],
      },
      {
        title: '4. Seguridad y contraseña maestra',
        paragraphs: [
          'La contraseña maestra nunca se almacena en texto plano: sólo se conserva un hash para verificar el acceso. Si la olvidás, no es posible recuperar el contenido cifrado desde esta aplicación.',
          'Vos sos responsable de conservar la contraseña en un lugar seguro y de mantener respaldos periódicos de tu bóveda.',
        ],
      },
      {
        title: '5. Terceros y servicios externos',
        paragraphs: [
          'La aplicación no integra servicios de inicio de sesión de terceros ni rastreadores. Algunas funciones de exportación (Excel, CSV, PDF) se ejecutan localmente en tu navegador mediante librerías que forman parte del propio proyecto.',
        ],
      },
      {
        title: '6. Tus derechos',
        paragraphs: [
          'Podés acceder, exportar y eliminar toda tu información desde la misma aplicación, usando las opciones de respaldo y borrado. Al eliminar los datos del navegador, la bóveda se borra de este dispositivo.',
        ],
      },
      {
        title: '7. Cambios en esta política',
        paragraphs: [
          'Esta política puede actualizarse para reflejar cambios en la aplicación. La fecha de última actualización se muestra al inicio del documento.',
        ],
      },
    ],
  },
  terms: {
    title: 'Términos y condiciones',
    updated: UPDATED,
    sections: [
      {
        title: '1. Aceptación',
        paragraphs: [
          'Al usar LifeKeeper aceptás estos términos y condiciones. Si no estás de acuerdo con ellos, no utilices la aplicación.',
        ],
      },
      {
        title: '2. Licencia de uso',
        paragraphs: [
          'Se otorga una licencia personal, no exclusiva e intransferible para usar la aplicación con fines personales y no comerciales. No se permite redistribuir, vender ni sublicenciar el software sin autorización.',
        ],
      },
      {
        title: '3. Contraseña maestra y acceso',
        paragraphs: [
          'La bóveda se protege con una contraseña maestra que sólo vos conocés. No existe un mecanismo de recuperación: si la perdés, los datos cifrados no podrán descifrarse.',
          'La aplicación se ejecuta en tu dispositivo; cualquier persona con acceso a tu sesión desbloqueada podrá ver el contenido.',
        ],
      },
      {
        title: '4. Respaldos y pérdida de datos',
        paragraphs: [
          'Los datos se almacenan en el almacenamiento local del navegador. Borrar los datos del sitio, cambiar de navegador o de dispositivo puede implicar la pérdida de la información si no contás con un respaldo.',
          'Sos responsable de generar y conservar respaldos periódicos y de verificar que puedan restaurarse.',
        ],
      },
      {
        title: '5. Uso aceptable',
        paragraphs: [
          'Te comprometés a utilizar la aplicación conforme a la ley y a no almacenar contenido ilícito ni a intentar vulnerar su seguridad o la de terceros.',
        ],
      },
      {
        title: '6. Propiedad intelectual',
        paragraphs: [
          'El nombre, el logotipo y el diseño de LifeKeeper pertenecen a su autor. Las librerías de terceros se utilizan bajo sus respectivas licencias.',
        ],
      },
      {
        title: '7. Limitación de responsabilidad',
        paragraphs: [
          'LifeKeeper es una herramienta de organización personal y no brinda asesoramiento médico, legal ni financiero. La información que registrás no reemplaza la consulta con profesionales.',
          'En la medida permitida por la ley, el autor no será responsable por daños derivados del uso o de la imposibilidad de uso de la aplicación, ni por la pérdida de datos.',
        ],
      },
      {
        title: '8. Disponibilidad y cambios',
        paragraphs: [
          'La aplicación se ofrece "tal cual", sin garantías de disponibilidad ininterrumpida. Estos términos pueden actualizarse; la versión vigente es la publicada en esta pantalla.',
        ],
      },
      {
        title: '9. Ley aplicable',
        paragraphs: [
          'Estos términos se rigen por las leyes de la República Argentina. Cualquier controversia se someterá a los tribunales competentes de dicho país.',
        ],
      },
    ],
  },
}
