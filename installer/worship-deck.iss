; Script generated for Inno Setup 6+
; Production Standalone Desktop Packaging Pipeline for WorshipDeck

#define MyAppName "WorshipDeck"
#ifndef MyAppVersion
  #error "MyAppVersion must be supplied via /D from package.json"
#endif
#define MyAppPublisher "Wira Delta Indonesia"
#define MyAppURL "https://wiradelta.com/worship-deck/"
#define MyAppSupportURL "https://github.com/wiradeltaid/worship-deck/issues"
#define MyAppUpdatesURL "https://github.com/wiradeltaid/worship-deck/releases"
#define MyAppExeName "worship-deck.exe"
#define MyAppId "{{8B237F02-4A82-41D1-9B5C-27806D678F12}"

[Setup]
AppId={#MyAppId}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppSupportURL}
AppUpdatesURL={#MyAppUpdatesURL}
DefaultDirName={autopf}\WorshipDeck
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=..\dist-installer
OutputBaseFilename=WorshipDeck-{#MyAppVersion}-x64-setup
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
SetupIconFile=worship-deck.ico
LicenseFile=..\dist-desktop\LICENSE
; Four DPI sizes (100/150/200/250%) of the modern-style 202x386; Inno picks the closest.
; Built in ops brand-identity/sampul/src/installer.py.
WizardImageFile=..\public\installer\wizard-image.png,..\public\installer\wizard-image-150.png,..\public\installer\wizard-image-200.png,..\public\installer\wizard-image-250.png
WizardSmallImageFile=..\public\installer\wizard-small.bmp
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
ShowLanguageDialog=auto
LanguageDetectionMethod=uilanguage

; VersionInfo and Copyright metadata
VersionInfoVersion={#MyAppVersion}
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription={#MyAppName} Setup
VersionInfoCopyright=Copyright (c) 2026 {#MyAppPublisher}
VersionInfoProductName={#MyAppName}
VersionInfoProductVersion={#MyAppVersion}
VersionInfoOriginalFileName=WorshipDeck-{#MyAppVersion}-x64-setup.exe
AppCopyright=Copyright (c) 2026 {#MyAppPublisher}
UninstallDisplayName={#MyAppName}
UninstallDisplayIcon={app}\worship-deck.ico

; Single-Instance Mutex Guards (Supports both new and legacy mutex)
AppMutex=Local\WorshipDeck.SingleInstance,Local\WorshipPresenter.SingleInstance,Global\WorshipDeck.SingleInstance
CloseApplications=yes
CloseApplicationsFilter=*.exe
RestartApplications=no

[Languages]
Name: "en"; MessagesFile: "compiler:Default.isl"
Name: "id"; MessagesFile: "languages\Indonesian.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Read-only Application Binaries and Assets in {app}
Source: "..\dist-desktop\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist-desktop\package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "worship-deck.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist-desktop\runtime\*"; DestDir: "{app}\runtime"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\dist-desktop\workers\*"; DestDir: "{app}\workers"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\dist-desktop\src\*"; DestDir: "{app}\src"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\dist-desktop\node_modules\*"; DestDir: "{app}\node_modules"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\dist-desktop\data\*"; DestDir: "{app}\data"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\dist-desktop\LICENSE"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist-desktop\ATTRIBUTIONS.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist-desktop\THIRD-PARTY-NOTICES"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist-desktop\PRIVACY.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\spa\dist\*"; DestDir: "{app}\spa\dist"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Parameters: "--desktop"; IconFilename: "{app}\worship-deck.ico"; WorkingDir: "{app}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"; IconFilename: "{app}\worship-deck.ico"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Parameters: "--desktop"; IconFilename: "{app}\worship-deck.ico"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Parameters: "--desktop"; WorkingDir: "{app}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Clean up only application program files and staged bundles, NEVER delete %LocalAppData%\WorshipDeck
Type: filesandordirs; Name: "{app}\spa"
Type: filesandordirs; Name: "{app}\runtime"
Type: filesandordirs; Name: "{app}\workers"
Type: filesandordirs; Name: "{app}\src"
Type: filesandordirs; Name: "{app}\node_modules"
Type: filesandordirs; Name: "{app}\data"
Type: files; Name: "{app}\{#MyAppExeName}"
Type: files; Name: "{app}\package.json"
Type: files; Name: "{app}\LICENSE"
Type: files; Name: "{app}\ATTRIBUTIONS.md"
Type: files; Name: "{app}\THIRD-PARTY-NOTICES"
Type: files; Name: "{app}\PRIVACY.md"

[Messages]
; Overrides for the stock Indonesian.isl (jrsoftware.org/files/istrans/, credited in that file's
; header). Terms below conflict with the WDI copy corpus (docs/korpus-dan-pola-copywriting-studio.md
; POLA-01: "file"/"folder" on every ID surface, never "berkas"/"direktori"/"map"); the upstream .isl
; is left untouched and only these message IDs are overridden here. Two stock IDs
; (AssocFileExtension, AssocingFileExtension) are not recognized as [Messages]-overridable by ISCC
; 6.7.3 ("not recognized by this version of Inno Setup" warning) and are instead patched directly,
; two lines only, in languages\Indonesian.isl.
id.LdrCannotCreateTemp=Tidak dapat membuat file sementara. Batal memasang
id.LdrCannotExecTemp=Tidak dapat menjalankan file di folder sementara. Batal memasang
id.SetupFileMissing=File %1 hilang dari folder instalasi. Silakan koreksi masalah atau dapatkan salinan program yang baru.
id.ErrorCreatingDir=Kami tidak dapat membuat folder "%1"
id.ErrorTooManyFilesInDir=Tidak dapat membuat file di folder "%1" karena berisi terlalu banyak file
id.ErrorFileSize=Ukuran file tidak sah: seharusnya %1, yang kami dapatkan %2
id.DownloadingLabel2=Mengunduh file...
id.ExtractingLabel=Mengekstrak file...
id.ApplicationsFound=Aplikasi berikut tengah memakai file-file yang perlu kami perbarui. Disarankan agar Anda mengizinkan kami untuk menutupnya secara otomatis.
id.ApplicationsFound2=Aplikasi berikut tengah memakai file-file yang perlu kami perbarui. Disarankan agar Anda mengizinkan kami untuk menutupnya secara otomatis. Selengkapnya memasang, kami akan berusaha memulai ulang aplikasi-aplikasi tersebut.
id.ErrorCloseApplications=Kami tidak dapat menutup semua aplikasi secara otomatis. Disarankan agar Anda menutup semua aplikasi yang memakai file-file yang perlu kami perbarui sebelum meneruskan.
id.ShowReadmeCheck=Ya, saya ingin melihat file README
id.SelectDiskLabel2=Silakan masukkan Diska %1 dan klik OK.%n%nBila file-file di dalam diska ini dapat ditemukan di folder lain selain yang ditampilkan di bawah, masukkan alamat yang benar atau klik Cari.
id.StatusCreateDirs=Membuat folder...
id.StatusExtractFiles=Mengekstrak file...
id.StatusDownloadFiles=Mengunduh file...
id.StatusRegisterFiles=Meregistrasi file...
id.ErrorExecutingProgram=Tidak dapat mengeksekusi file:%n%1
id.ErrorIniEntry=Galat membuat catatan INI dalam file "%1".
id.FileAbortRetryIgnoreSkipNotRecommended=&Lewati file ini (tidak disarankan)
id.SourceVerificationFailed=Verifikasi file asal gagal: %1
id.VerificationFileNameIncorrect=Nama file tidak sah
id.VerificationFileTagIncorrect=Tag file tidak sah
id.VerificationFileSizeIncorrect=Ukuran file tidak sah
id.VerificationFileHashIncorrect=Hash file tidak sah
id.ExistingFileReadOnlyKeepExisting=&Pertahankan file yang sudah ada
id.FileExistsOverwriteExisting=&Timpa file yang sudah ada
id.FileExistsKeepExisting=&Pertahankan file yang sudah ada
id.ExistingFileNewerOverwriteExisting=&Timpa file yang sudah ada
id.ExistingFileNewerKeepExisting=&Pertahankan file yang sudah ada (disarankan)
id.ErrorReadingExistingDest=Terjadi galat saat berusaha membaca file yang sudah ada:
id.ErrorChangingAttr=Terjadi galat saat berusaha mengubah atribusi file yang sudah ada:
id.ErrorCreatingTemp=Terjadi galat saat berusaha membuat file di folder tujuan:
id.ErrorDownloading=Terjadi galat saat berusaha mengunduh file:
id.ErrorReadingSource=Terjadi galat saat berusaha membaca file asal:
id.ErrorCopying=Terjadi galat saat berusaha menyalin file:
id.ErrorReplacingExistingFile=Terjadi galat saat berusaha menimpa file yang sudah ada:
id.ErrorRenamingTemp=Terjadi galat saat berusaha mengubah nama file di folder tujuan:
id.ErrorRegisterTypeLib=Tidak dapat meregistrasi file referensi: %1
id.ErrorOpeningReadme=Terjadi galat saat berusaha membuka file README.
id.ConfirmDeleteSharedFile2=Sistem mengindikasi bahwa file bersama di bawah ini tidak lagi dipakai oleh program mana pun. Apa Anda ingin agar kami menghapusnya?%n%nBila masih ada program yang memakainya dan file ini dihapus, program tersebut dapat tidak berfungsi dengan semestinya. Bila Anda ragu, pilih No. Membiarkan file ini pada sistem Anda takkan membahayakan.
id.SharedFileNameLabel=Nama file:

[CustomMessages]
en.UninstallDataWipePrompt=Do you also want to remove all local user data, service plans, and local databases in %1?%n%nSelect "No" to keep your data for future installations.
id.UninstallDataWipePrompt=Apakah Anda juga ingin menghapus semua data pengguna lokal, paket layanan, dan basis data lokal di %1?%n%nPilih "Tidak" untuk menyimpan data Anda untuk pemasangan berikutnya.

[Code]
// Data preservation guarantee & interactive wipe option:
// Prompts the user during uninstallation whether to remove local databases in %LocalAppData%\WorshipDeck.
// If the user selects "No", the directory is preserved for future installations.
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  DataDir: String;
  MsgPrompt: String;
begin
  if CurUninstallStep = usUninstall then
  begin
    DataDir := ExpandConstant('{localappdata}\WorshipDeck');
    if DirExists(DataDir) then
    begin
      MsgPrompt := FmtMessage(CustomMessage('UninstallDataWipePrompt'), [DataDir]);
      if MsgBox(MsgPrompt, mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES then
      begin
        Log('User confirmed local data wipe: removing ' + DataDir);
        DelTree(DataDir, True, True, True);
      end
      else
      begin
        Log('Data preservation invariant: Preserving user data directory at ' + DataDir);
      end;
    end;
  end;
end;
