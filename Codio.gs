// ID de la carpeta principal en Google Drive donde están todas las subcarpetas de seminarios.
// ¡Importante!: Asegurate de que esta ID sea correcta y que la cuenta de Google
// con la que despliegues el script tenga permisos de lectura sobre esta carpeta y su contenido.
const ID_CARPETA_PRINCIPAL_CERTIFICADOS = '19NGDYiP9IUOBE9yHjTLeMzPd3Pgu69V7'; 

// Este es el nombre exacto de la subcarpeta que contiene material adicional (como diapositivas, recursos)
// dentro de cada carpeta de seminario. Por ejemplo, si tienes "Mi_Seminario/Contenido/documento.pdf".
const NOMBRE_CARPETA_CONTENIDO = 'Contenido'; 

// Define una clave para guardar el contador global de descargas en las propiedades del script.
const DOWNLOAD_COUNTER_KEY = 'totalDownloads';

/**
 * Esta función se ejecuta cuando alguien accede a la URL de tu aplicación web (la URL que obtienes
 * al desplegar el script como aplicación web).
 * Su propósito es servir el contenido HTML de tu interfaz de usuario.
 * @returns {HtmlOutput} El contenido HTML de la aplicación web.
 */
function doGet() {
  // Carga el archivo 'index.html' y lo evalúa para que pueda usar scripts de servidor.
  return HtmlService.createTemplateFromFile('index').evaluate()
      .setTitle('Buscador de Certificados') // Establece el título que aparece en la pestaña del navegador.
      .setFaviconUrl('https://img.icons8.com/ios-filled/50/000000/certificate.png'); // Icono pequeño en la pestaña del navegador.
}

/**
 * Una función de utilidad para incluir otros archivos (como CSS o JavaScript) en tu HTML.
 * Aunque en tu 'index.html' actual los estilos y scripts están directamente,
 * esta función es una buena práctica para organizar proyectos más grandes.
 * @param {string} filename El nombre del archivo CSS/JS que se desea incluir.
 * @returns {string} El contenido del archivo.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Incrementa el contador global de descargas en 1.
 * Esta función es llamada desde el JavaScript del lado del cliente cuando se descarga un certificado.
 */
function incrementDownloadCounter() {
  const scriptProperties = PropertiesService.getScriptProperties();
  // Obtiene el valor actual del contador. Si no existe, lo inicializa en '0'.
  let currentCount = parseInt(scriptProperties.getProperty(DOWNLOAD_COUNTER_KEY) || '0', 10);
  currentCount++; // Incrementa el contador.
  // Guarda el nuevo valor en las propiedades del script.
  scriptProperties.setProperty(DOWNLOAD_COUNTER_KEY, currentCount.toString());
  Logger.log(`Contador de descargas incrementado a: ${currentCount}`); // Para ver en los logs de Apps Script.
}

/**
 * Recupera el valor actual del contador global de descargas.
 * Esta función es llamada desde el JavaScript del lado del cliente al cargar la página.
 * @returns {number} El número total actual de descargas.
 */
function getDownloadCount() {
  const scriptProperties = PropertiesService.getScriptProperties();
  // Obtiene el valor actual del contador. Si no existe, devuelve 0.
  const currentCount = parseInt(scriptProperties.getProperty(DOWNLOAD_COUNTER_KEY) || '0', 10);
  Logger.log(`Se solicitó el contador de descargas actual: ${currentCount}`); // Para ver en los logs de Apps Script.
  return currentCount;
}

/**
 * Esta es la función principal que el JavaScript de tu 'index.html' llamará (a través de google.script.run).
 * Su objetivo es buscar certificados y material relacionado para un DNI específico en Google Drive.
 *
 * Busca archivos PDF cuyos nombres contengan el DNI.
 * También intenta encontrar una subcarpeta llamada 'Contenido' dentro de la carpeta del seminario.
 *
 * @param {string} dni El DNI (número de documento de identidad) que se desea buscar.
 * @returns {Array} Un array de objetos. Cada objeto representa un seminario encontrado
 * y contiene el nombre del seminario, la URL de descarga del certificado y la URL de la carpeta de contenido (si existe).
 */
function buscarCertificados(dni) {
  const resultados = []; // Aquí guardaremos los datos de todos los seminarios encontrados para el DNI.
  const carpetaPrincipal = DriveApp.getFolderById(ID_CARPETA_PRINCIPAL_CERTIFICADOS);

  // Primero, verificamos si la carpeta principal existe. Si no, registramos un error y devolvemos un array vacío.
  if (!carpetaPrincipal) {
    Logger.log('Error: La carpeta principal de certificados no fue encontrada. Verificá el ID.');
    return []; 
  }

  // Obtenemos todas las subcarpetas dentro de la carpeta principal. Cada una de estas subcarpetas
  // se considera una carpeta de un seminario individual (ej: "Inteligencia_Artificial", "Marketing_Digital").
  const carpetasSeminarios = carpetaPrincipal.getFolders(); 

  // Iteramos sobre cada una de las carpetas de seminarios.
  while (carpetasSeminarios.hasNext()) {
    const carpetaSeminario = carpetasSeminarios.next();
    const nombreSeminario = carpetaSeminario.getName(); // Obtenemos el nombre de la carpeta del seminario.
    Logger.log(`Procesando carpeta de seminario: ${nombreSeminario}`);

    // Dentro de cada carpeta de seminario, buscamos archivos PDF.
    const archivosPdfEnSeminario = carpetaSeminario.getFilesByType(MimeType.PDF);
    let archivoCertificadoEncontrado = null; // Variable para guardar el archivo PDF del certificado si lo encontramos.

    // Iteramos sobre cada archivo PDF en la carpeta actual del seminario.
    while (archivosPdfEnSeminario.hasNext()) {
      const pdfFile = archivosPdfEnSeminario.next();
      const pdfFileName = pdfFile.getName(); // Obtenemos el nombre del archivo PDF.
      Logger.log(`   Verificando PDF: ${pdfFileName}`);

      // Comprobamos si el nombre del archivo PDF contiene el DNI que estamos buscando.
      // ¡Esto es crucial! Tus certificados deben tener el DNI en su nombre para que sean encontrados.
      if (pdfFileName.includes(dni)) {
        archivoCertificadoEncontrado = pdfFile;
        Logger.log(`   ¡DNI ${dni} encontrado en el archivo: ${pdfFileName}`);
        break; // Una vez que encontramos un certificado para el DNI en este seminario, salimos de este bucle.
      }
    }

    // Si encontramos un archivo de certificado para el DNI en este seminario:
    if (archivoCertificadoEncontrado) {
      const seminarData = {
        // Formateamos el nombre del seminario (ej. "Inteligencia_Artificial" a "Inteligencia Artificial").
        nombreSeminario: nombreSeminario.replace(/_/g, ' '), 
        // Obtenemos la URL directa de descarga del archivo PDF del certificado.
        certificadoUrl: archivoCertificadoEncontrado.getDownloadUrl(),
        carpetaContenidoUrl: null // Inicializamos la URL de la carpeta de contenido como nula.
      };

      // Ahora, buscamos una subcarpeta llamada 'Contenido' dentro de la carpeta de este seminario.
      const carpetasContenido = carpetaSeminario.getFoldersByName(NOMBRE_CARPETA_CONTENIDO);
      if (carpetasContenido.hasNext()) {
        const carpetaContenido = carpetasContenido.next();
        // Si encontramos la carpeta 'Contenido', guardamos su URL para que el usuario pueda acceder al material.
        seminarData.carpetaContenidoUrl = carpetaContenido.getUrl(); 
      }
      resultados.push(seminarData); // Agregamos los datos de este seminario a nuestra lista de resultados.
    }
  }
  Logger.log(`Búsqueda completada para DNI ${dni}. Seminarios encontrados: ${resultados.length}`);
  return resultados; // Devolvemos el array con todos los seminarios encontrados para el DNI.
}