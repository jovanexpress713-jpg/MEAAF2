> **ملاحظة تاريخية:** هذا النص هو سجلّ التسليم المصدر الذي جاء داخل الأرشيف. لا يثبت أن كل الملفات المذكورة فيه كانت مرفقة أو مبنية. راجع نتيجة الفحص الأحدث في `PRODUCTION_AUDIT.md`.

# التسليم النهائي — خريطة المشروع الكاملة + الملفات الناقصة

**وضع صادق أولاً:** المشروع الآن = **~50 ملفاً**. حجمها الفعلي أكبر من أن يُرمى في رسالة واحدة (ستتجاوز حدود الرسالة ويُقطع الكود وسطاً — كما حدث في رسالة الفاتورة السابقة). لذلك سأعمل الآن كالتالي:

1. **هذه الرسالة:** خريطة الملفات الكاملة + **الملفات التي كانت ناقصة فعلاً** (بدونها المشروع لا يُترجم) + إصلاح خطأ حقيقي اكتشفته
2. **الرسائل التالية:** أعيد إرسال كل الأكواد **نسخاً نهائية مرتبة** دفعة-دفعة. تكتب "اكمل" في كل مرة.

---

## 1) خريطة الملفات الكاملة (Manifest)

### قاعدة البيانات — `db/` (سُلّمت كاملة سابقاً — اطلب أي واحدة "أعد إرسال X")

| الملف | الحالة |
|---|---|
| `01_full_schema.sql` | ✅ نهائي (رسالة "النسخة الجاهزة") |
| `02_tests.sql` (T1–T15) | ✅ نهائي |
| `05_migration.sql` | ✅ نهائي |
| `06_security_admin.sql` + `06_tests.sql` | ✅ نهائي |
| `07_licensing.sql` | ✅ نهائي |
| `08_billing_full.sql` | ✅ نهائي |
| **`09_permissions_patch.sql`** | 🔴 **جديد — أدناه (إصلاح خطأ حقيقي)** |

### كود C#

| المجموعة | الملفات | الحالة |
|---|---|---|
| **MEAAF.Core** | Models.cs, Perm.cs, LicensingModels.cs, IConnector.cs | 📦 دفعة B |
| **MEAAF.Data** | SqlDbFactory.cs | 📦 دفعة B |
| **MEAAF.Security** | PasswordHasher, AuthService, AuthorizationService, LicenseEngine | 📦 دفعة B |
| **MEAAF.Business** | Setup, Journal, JournalOps, Account, Patient, Report, UserAdmin, Billing, Migration | 📦 دفعة C |
| **MEAAF.Connectors** | SqlServerConnector.cs | 🔴 **مُصحَّح — أدناه** |
| **MEAAF.UI** | App, MainWindow, Login, Setup, Helpers, ExportHelpers | 📦 دفعة D |
| **MEAAF.UI/Pages** | Dashboard, Patients, Finance, Reports, Security, Licensing | 📦 دفعة D/E |
| **MEAAF.UI/Pages** | BillingView.xaml, MigrationControl.xaml | ✅ سُلِما — مع رقعة أدناه |
| **MEAAF.UI/Pages** | **BillingView.xaml.cs** | 🔴 **كان مقطوعاً — النسخة الكاملة أدناه** |
| **MEAAF.UI/Pages** | **MigrationControl.xaml.cs** | 🔴 **لم يُسلَّم قط — أدناه** |
| **MEAAF.UI/Dialogs** | AddPatient, JournalEntry, EntryLines, ReverseEntry, UserEdit, ResetPassword, SimpleInput | 📦 دفعة E |
| **MEAAF.UI/Dialogs** | **PaymentWindow, InvoiceDetailWindow** | 🔴 **لم يُسلَّما قط — أدناه** |
| **tests** | PasswordTests.cs | 📦 دفعة E |
| **Root** | setup.ps1, App.config, MEAAF.sln | 📦 دفعة E |

---

## 2) `db/09_permissions_patch.sql` — إصلاح خطأ حقيقي

**الخطأ:** `MigrationService` يطلب صلاحيات `Migration:View/Create`، لكن جدول `Core.Permissions` لا يحتوي مورد "Migration" ولا "Licensing" → **الوحدتان كانتا سترفضان لكل المستخدمين بما فيهم المدير**. هذا الرقع يصلحها:

```sql
USE MEAAF_DB;
GO
/* إضافة الموارد الناقصة */
INSERT Core.Permissions (Resource, Action)
SELECT r.v, a.v
FROM (VALUES (N'Migration'),(N'Licensing')) r(v)
CROSS JOIN (VALUES (N'View'),(N'Create'),(N'Edit'),(N'Delete'),(N'Approve'),(N'Configure')) a(v)
WHERE NOT EXISTS (SELECT 1 FROM Core.Permissions p WHERE p.Resource=r.v AND p.Action=a.v);
GO
/* منحها لدور مدير النظام في كل المنشآت */
INSERT Core.RolePermissions (RoleId, PermissionId)
SELECT r.RoleId, p.PermissionId
FROM Core.Roles r
CROSS JOIN Core.Permissions p
WHERE r.Name = N'مدير النظام'
  AND p.Resource IN (N'Migration', N'Licensing')
  AND NOT EXISTS (SELECT 1 FROM Core.RolePermissions rp
                  WHERE rp.RoleId = r.RoleId AND rp.PermissionId = p.PermissionId);
GO
PRINT N'=== PERMISSIONS PATCH DONE ===';
```

---

## 3) `Dialogs/PaymentWindow.xaml` + `.cs` — (كان ناقصاً)

```xml
<Window x:Class="MEAAF.UI.Dialogs.PaymentWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="تسجيل دفعة" Width="430" Height="380"
        WindowStartupLocation="CenterOwner" ResizeMode="NoResize"
        FlowDirection="RightToLeft" FontFamily="Segoe UI, Tahoma" FontSize="14">
    <StackPanel Margin="28">
        <TextBlock x:Name="TitleText" FontSize="17" FontWeight="Bold"
                   Foreground="#065F46" Margin="0,0,0,14" TextWrapping="Wrap"/>

        <Border Background="#ECFDF5" CornerRadius="8" Padding="12" Margin="0,0,0,14">
            <StackPanel Orientation="Horizontal">
                <TextBlock Text="المتبقي على الفاتورة: " Foreground="#065F46"/>
                <TextBlock x:Name="RemainingText" FontWeight="Bold" Foreground="#065F46"/>
            </StackPanel>
        </Border>

        <TextBlock Text="مبلغ الدفعة *" FontSize="12" Foreground="#64748B"/>
        <Grid Margin="0,4,0,6">
            <Grid.ColumnDefinitions>
                <ColumnDefinition/><ColumnDefinition Width="Auto"/>
            </Grid.ColumnDefinitions>
            <TextBox x:Name="AmountBox" Padding="10,8" FontSize="16"/>
            <Button Grid.Column="1" Content="المتبقي كاملاً" Click="FillRemaining_Click"
                    Margin="8,0,0,0" Padding="12,8" Background="#F1F5F9"
                    BorderThickness="0" Cursor="Hand"/>
        </Grid>

        <TextBlock Text="طريقة الدفع" FontSize="12" Foreground="#64748B" Margin="0,6,0,4"/>
        <ComboBox x:Name="MethodCombo" SelectedIndex="0" Padding="8,6">
            <ComboBoxItem Content="نقدي (الصندوق)" Tag="1"/>
            <ComboBoxItem Content="بنكي (الحساب البنكي)" Tag="2"/>
        </ComboBox>

        <TextBlock Text="سيُنشأ قيد تحصيل آلي ومعتمد ويرتبط بالفاتورة."
                   Foreground="#94A3B8" FontSize="12" Margin="0,12,0,0"/>
        <TextBlock x:Name="ErrorText" Foreground="#DC2626" TextWrapping="Wrap" Margin="0,8,0,0"/>

        <WrapPanel Margin="0,16,0,0">
            <Button Content="💾 تسجيل الدفعة" Click="Ok_Click" IsDefault="True" Padding="24,9"
                    Background="#16A34A" Foreground="White" BorderThickness="0"
                    FontWeight="SemiBold" Cursor="Hand" Margin="0,0,10,0"/>
            <Button Content="إلغاء" Click="Cancel_Click" IsCancel="True" Padding="24,9"
                    Background="#F1F5F9" Foreground="#64748B" BorderThickness="0" Cursor="Hand"/>
        </WrapPanel>
    </StackPanel>
</Window>
```

```csharp
using System.Windows;
using MEAAF.Core;

namespace MEAAF.UI.Dialogs
{
    public partial class PaymentWindow : Window
    {
        private readonly decimal _remaining;
        public decimal Amount { get; private set; }
        public int Method
        {
            get
            {
                var item = (System.Windows.Controls.ComboBoxItem)MethodCombo.SelectedItem;
                return int.Parse(item.Tag.ToString());
            }
        }

        public PaymentWindow(string invoiceNo, decimal remaining)
        {
            InitializeComponent();
            _remaining = remaining;
            TitleText.Text = $"💰 دفعة للفاتورة {invoiceNo}";
            RemainingText.Text = remaining.ToString("N2");
            AmountBox.Text = remaining.ToString("0.##");
            AmountBox.SelectAll();
            AmountBox.Focus();
        }

        private void FillRemaining_Click(object s, RoutedEventArgs e)
            => AmountBox.Text = _remaining.ToString("0.##");

        private void Ok_Click(object s, RoutedEventArgs e)
        {
            ErrorText.Text = "";
            if (!NumParse.TryAmount(AmountBox.Text, out var amt))
            { ErrorText.Text = "أدخل مبلغاً صحيحاً."; return; }
            if (amt <= 0) { ErrorText.Text = "المبلغ يجب أن يكون أكبر من صفر."; return; }
            if (amt > _remaining) { ErrorText.Text = $"المبلغ يتجاوز المتبقي ({_remaining:N2})."; return; }
            Amount = amt;
            DialogResult = true;
        }
        private void Cancel_Click(object s, RoutedEventArgs e) => DialogResult = false;
    }
}
```

---

## 4) `Dialogs/InvoiceDetailWindow.xaml` + `.cs` — (كان ناقصاً)

```xml
<Window x:Class="MEAAF.UI.Dialogs.InvoiceDetailWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="تفاصيل الفاتورة" Width="780" Height="700"
        WindowStartupLocation="CenterOwner"
        FlowDirection="RightToLeft" FontFamily="Segoe UI, Tahoma" FontSize="14">
    <Grid Margin="20">
        <Grid.RowDefinitions>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="*"/>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="Auto"/>
        </Grid.RowDefinitions>

        <!-- رأس الفاتورة -->
        <Border Grid.Row="0" Background="#F8FAFC" CornerRadius="8" Padding="14">
            <StackPanel>
                <WrapPanel>
                    <TextBlock x:Name="HdrNo" FontSize="18" FontWeight="Bold" Foreground="#1E5EFF" Margin="0,0,16,0"/>
                    <TextBlock x:Name="HdrStatus" FontWeight="Bold" Margin="0,0,16,0"/>
                    <TextBlock x:Name="HdrDate" Foreground="#64748B"/>
                </WrapPanel>
                <WrapPanel Margin="0,8,0,0">
                    <TextBlock x:Name="HdrPatient" Foreground="#334155" Margin="0,0,16,0"/>
                    <TextBlock x:Name="HdrPayer" Foreground="#334155" Margin="0,0,16,0"/>
                    <TextBlock x:Name="HdrCompany" Foreground="#0369A1"/>
                </WrapPanel>
                <TextBlock x:Name="HdrNotes" Foreground="#94A3B8" FontSize="12"
                           Margin="0,6,0,0" TextWrapping="Wrap"/>
            </StackPanel>
        </Border>

        <TextBlock Grid.Row="1" Text="بنود الفاتورة" FontWeight="Bold"
                   Foreground="#1E293B" Margin="0,12,0,6"/>

        <Border Grid.Row="2" Background="White" CornerRadius="8" Padding="10"
                BorderBrush="#E2E8F0" BorderThickness="1">
            <DataGrid x:Name="LinesGrid" AutoGenerateColumns="False" IsReadOnly="True"
                      HeadersVisibility="Column" GridLinesVisibility="Horizontal" BorderThickness="0">
                <DataGrid.Columns>
                    <DataGridTextColumn Header="الكود"  Binding="{Binding ServiceCode}" Width="90"/>
                    <DataGridTextColumn Header="الخدمة" Binding="{Binding ServiceName}" Width="*"/>
                    <DataGridTextColumn Header="كمية"   Binding="{Binding Qty}" Width="60"/>
                    <DataGridTextColumn Header="سعر"    Binding="{Binding UnitPrice, StringFormat=N2}" Width="100"/>
                    <DataGridTextColumn Header="إجمالي" Binding="{Binding LineTotal, StringFormat=N2}" Width="110"/>
                </DataGrid.Columns>
            </DataGrid>
        </Border>

        <!-- الدفعات -->
        <StackPanel Grid.Row="3" x:Name="PaysSection" Margin="0,10,0,0">
            <TextBlock Text="الدفعات المسجلة" FontWeight="Bold" Foreground="#1E293B" Margin="0,0,0,6"/>
            <Border Background="White" CornerRadius="8" Padding="10"
                    BorderBrush="#E2E8F0" BorderThickness="1" MaxHeight="140">
                <DataGrid x:Name="PaysGrid" AutoGenerateColumns="False" IsReadOnly="True"
                          HeadersVisibility="Column" GridLinesVisibility="Horizontal" BorderThickness="0">
                    <DataGrid.Columns>
                        <DataGridTextColumn Header="التاريخ" Binding="{Binding DateText}" Width="150"/>
                        <DataGridTextColumn Header="المبلغ"  Binding="{Binding Amount, StringFormat=N2}" Width="120"/>
                        <DataGridTextColumn Header="الطريقة" Binding="{Binding MethodText}" Width="120"/>
                    </DataGrid.Columns>
                </DataGrid>
            </Border>
        </StackPanel>

        <!-- الملخص -->
        <Border Grid.Row="4" Background="#F8FAFC" CornerRadius="8" Padding="14" Margin="0,12,0,0">
            <StackPanel>
                <Grid>
                    <TextBlock Text="الإجمالي" Foreground="#64748B"/>
                    <TextBlock x:Name="TGross" HorizontalAlignment="Left" FontWeight="SemiBold"/>
                </Grid>
                <Grid Margin="0,3,0,0">
                    <TextBlock Text="الخصم" Foreground="#64748B"/>
                    <TextBlock x:Name="TDisc" HorizontalAlignment="Left" Foreground="#DC2626"/>
                </Grid>
                <Grid Margin="0,3,0,0">
                    <TextBlock Text="الضريبة" Foreground="#64748B"/>
                    <TextBlock x:Name="TTax" HorizontalAlignment="Left" Foreground="#D97706"/>
                </Grid>
                <Grid Margin="0,3,0,0">
                    <TextBlock Text="الصافي" FontWeight="Bold" Foreground="#1E293B"/>
                    <TextBlock x:Name="TNet" HorizontalAlignment="Left" FontWeight="Bold" Foreground="#1E293B"/>
                </Grid>
                <StackPanel x:Name="SplitSec" Margin="0,6,0,0">
                    <Grid>
                        <TextBlock Text="حصة التأمين" Foreground="#0369A1"/>
                        <TextBlock x:Name="TIns" HorizontalAlignment="Left" Foreground="#0369A1"/>
                    </Grid>
                    <Grid Margin="0,3,0,0">
                        <TextBlock Text="حصة المريض" Foreground="#DC2626"/>
                        <TextBlock x:Name="TPat" HorizontalAlignment="Left" Foreground="#DC2626"/>
                    </Grid>
                </StackPanel>
                <Border BorderBrush="#E2E8F0" BorderThickness="0,1,0,0" Margin="0,8,0,8"/>
                <Grid>
                    <TextBlock Text="المدفوع" Foreground="#16A34A" FontWeight="SemiBold"/>
                    <TextBlock x:Name="TPaid" HorizontalAlignment="Left" Foreground="#16A34A" FontWeight="SemiBold"/>
                </Grid>
                <Grid Margin="0,3,0,0">
                    <TextBlock Text="المتبقي" FontWeight="Bold"/>
                    <TextBlock x:Name="TRem" HorizontalAlignment="Left" FontWeight="Bold"/>
                </Grid>
            </StackPanel>
        </Border>
    </Grid>
</Window>
```

```csharp
using System.Windows;
using System.Windows.Media;
using MEAAF.Business;

namespace MEAAF.UI.Dialogs
{
    public partial class InvoiceDetailWindow : Window
    {
        public InvoiceDetailWindow(InvoiceDetail det)
        {
            InitializeComponent();
            var h = det.Header;

            HdrNo.Text = h.InvoiceNo;
            HdrStatus.Text = h.StatusText;
            HdrStatus.Foreground = h.Status == 2 ? Brushes.Green
                                 : h.Status == 3 ? Brushes.Red : Brushes.DarkOrange;
            HdrDate.Text = h.InvoiceDate.ToLocalTime().ToString("yyyy/MM/dd HH:mm");
            HdrPatient.Text = $"{h.PatientName} ({h.MRN})";
            HdrPayer.Text = h.PayerText;
            HdrCompany.Text = h.CompanyName ?? "";
            HdrNotes.Text = string.IsNullOrWhiteSpace(h.Notes) ? "" : "ملاحظات: " + h.Notes;

            LinesGrid.ItemsSource = det.Lines;
            PaysGrid.ItemsSource = det.Payments;
            PaysSection.Visibility = det.Payments.Count == 0
                ? Visibility.Collapsed : Visibility.Visible;

            TGross.Text = h.GrossAmount.ToString("N2");
            TDisc.Text = "-" + h.DiscountAmount.ToString("N2");
            TTax.Text = h.TaxAmount.ToString("N2");
            TNet.Text = h.NetAmount.ToString("N2");

            bool ins = h.PayerType == 2;
            SplitSec.Visibility = ins ? Visibility.Visible : Visibility.Collapsed;
            TIns.Text = h.InsuranceShare.ToString("N2");
            TPat.Text = h.PatientShare.ToString("N2");

            TPaid.Text = h.PaidAmount.ToString("N2");
            TRem.Text = h.Remaining.ToString("N2");
            TRem.Foreground = h.Remaining > 0 ? Brushes.DarkOrange : Brushes.Green;
        }
    }
}
```

---

## 5) `Pages/BillingView.xaml.cs` — النسخة الكاملة النهائية (كانت مقطوعة)

```csharp
using System;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using MEAAF.Business;
using MEAAF.Core;

namespace MEAAF.UI.Pages
{
    public sealed class InvoiceLineVm
    {
        public int ServiceId { get; set; }
        public string ServiceName { get; set; }
        public int Qty { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal Total => Qty * UnitPrice;
    }

    public partial class BillingView : UserControl
    {
        private readonly BillingService _bilSvc;
        private readonly PatientService _patSvc;
        private readonly UserContext _ctx;
        private readonly ObservableCollection<InvoiceLineVm> _lines = new ObservableCollection<InvoiceLineVm>();
        private PatientInfo _patient;
        private int _invPage = 1, _invTotal;
        private const int InvPageSize = 50;

        public BillingView(BillingService bilSvc, PatientService patSvc, UserContext ctx)
        {
            InitializeComponent();
            _bilSvc = bilSvc; _patSvc = patSvc; _ctx = ctx;
            LinesGrid.ItemsSource = _lines;

            BtnView.Visibility  = Perm.Has(ctx, Res.Invoices, Act.View)   ? Visibility.Visible : Visibility.Collapsed;
            BtnPay.Visibility   = Perm.Has(ctx, Res.Invoices, Act.Edit)   ? Visibility.Visible : Visibility.Collapsed;
            BtnVoid.Visibility  = Perm.Has(ctx, Res.Invoices, Act.Delete) ? Visibility.Visible : Visibility.Collapsed;
            BtnPrint.Visibility = Perm.Has(ctx, Res.Invoices, Act.Print)  ? Visibility.Visible : Visibility.Collapsed;

            Loaded += async (s, e) => await InitAsync();
        }

        private async Task InitAsync()
        {
            try
            {
                await _bilSvc.SeedDemoDataAsync(_ctx);
                ServiceCombo.ItemsSource = await _bilSvc.GetServicesAsync(_ctx);
                CompanyCombo.ItemsSource = await _bilSvc.GetInsuranceCompaniesAsync(_ctx);
                PatientCombo.ItemsSource = await _patSvc.GetListAsync(_ctx, null);
                RecalcTotals();
            }
            catch (UnauthorizedAccessException ua) { Warn(ua.Message); }
            catch (Exception ex) { Warn("خطأ في التحميل: " + ex.Message); }
        }

        /* ===== اختيار المريض ===== */
        private async void PatientCombo_Changed(object sender, SelectionChangedEventArgs e)
        {
            if (!(PatientCombo.SelectedValue is long pid)) return;
            try
            {
                _patient = await _bilSvc.GetPatientInfoAsync(_ctx, pid);
                if (_patient == null) return;
                PatientNameText.Text = _patient.FullName;
                PatientInfoText.Text = $"MRN: {_patient.MRN} | {_patient.GenderText}"
                    + (_patient.AgeYears.HasValue ? $" | العمر: {_patient.AgeYears}" : "")
                    + (string.IsNullOrWhiteSpace(_patient.Phone) ? "" : $" | {_patient.Phone}");
            }
            catch (Exception ex) { Warn("خطأ: " + ex.Message); }
        }

        /* ===== بنود الفاتورة ===== */
        private void AddService_Click(object sender, RoutedEventArgs e)
        {
            if (!(ServiceCombo.SelectedItem is BillingServiceItem srv)) return;
            var existing = _lines.FirstOrDefault(x => x.ServiceId == srv.ServiceId);
            if (existing != null) existing.Qty++;
            else _lines.Add(new InvoiceLineVm
            { ServiceId = srv.ServiceId, ServiceName = srv.NameAr, Qty = 1, UnitPrice = srv.Price });
            LinesGrid.Items.Refresh();
            EmptyLines.Visibility = _lines.Count == 0 ? Visibility.Visible : Visibility.Collapsed;
            RecalcTotals();
        }

        private void RemoveLine_Click(object sender, RoutedEventArgs e)
        {
            if ((sender as FrameworkElement)?.DataContext is InvoiceLineVm vm)
            {
                _lines.Remove(vm);
                LinesGrid.Items.Refresh();
                EmptyLines.Visibility = _lines.Count == 0 ? Visibility.Visible : Visibility.Collapsed;
                RecalcTotals();
            }
        }

        private void PayerType_Changed(object sender, RoutedEventArgs e)
        {
            if (InsPanel == null) return;
            bool isIns = InsRadio.IsChecked == true;
            InsPanel.Visibility = isIns ? Visibility.Visible : Visibility.Collapsed;
            SplitPanel.Visibility = isIns ? Visibility.Visible : Visibility.Collapsed;
            RecalcTotals();
        }

        private void RecalcTotals(object sender = null, RoutedEventArgs e = null)
        {
            if (GrossText == null) return;
            decimal gross = _lines.Sum(x => x.Total);
            decimal disc = NumParse.TryAmount(DiscountBox.Text, out var d) ? Math.Min(Math.Max(d, 0), gross) : 0;
            decimal taxPct = NumParse.TryAmount(TaxBox.Text, out var tp) ? Math.Max(tp, 0) : 0;
            decimal subtotal = gross - disc;
            decimal tax = Math.Round(subtotal * taxPct / 100m, 4);
            decimal net = subtotal + tax;

            GrossText.Text = gross.ToString("N2");
            DiscText.Text = "-" + disc.ToString("N2");
            TaxAmtText.Text = tax.ToString("N2");
            NetText.Text = net.ToString("N2");

            if (InsRadio != null && InsRadio.IsChecked == true)
            {
                decimal cov = NumParse.TryAmount(CoverageBox.Text, out var c) ? Math.Min(Math.Max(c, 0), 100) : 0;
                decimal insShare = Math.Round(net * cov / 100m, 4);
                InsShareText.Text = insShare.ToString("N2");
                PatShareText.Text = (net - insShare).ToString("N2");
            }
        }

        /* ===== إصدار الفاتورة ===== */
        private async void SaveInvoice_Click(object sender, RoutedEventArgs e)
        {
            ErrorText.Text = "";
            if (_patient == null) { ErrorText.Text = "اختر مريضاً أولاً."; return; }
            if (_lines.Count == 0) { ErrorText.Text = "أضف خدمة واحدة على الأقل."; return; }

            bool isIns = InsRadio.IsChecked == true;
            int? companyId = null;
            decimal coverage = 100;

            if (isIns)
            {
                if (!(CompanyCombo.SelectedValue is int cid))
                { ErrorText.Text = "اختر شركة التأمين."; return; }
                companyId = cid;
                coverage = NumParse.TryAmount(CoverageBox.Text, out var c) ? Math.Min(Math.Max(c, 0), 100) : 100;
            }

            var req = new InvoiceCreateRequest
            {
                PatientId = _patient.PatientId,
                PayerType = isIns ? 2 : 1,
                CompanyId = companyId,
                CoveragePct = coverage,
                DiscountAmount = NumParse.TryAmount(DiscountBox.Text, out var d) ? d : 0,
                TaxPct = NumParse.TryAmount(TaxBox.Text, out var tp) ? tp : 0,
                Notes = NotesBox.Text,
                Lines = _lines.Select(x => new InvoiceLineRequest
                { ServiceId = x.ServiceId, Qty = x.Qty, UnitPrice = x.UnitPrice }).ToList()
            };

            SaveBtn.IsEnabled = false;
            try
            {
                long invId = await _bilSvc.CreateInvoiceAsync(_ctx, req);
                var det = await _bilSvc.GetInvoiceDetailsAsync(_ctx, invId);

                var ok = MessageBox.Show(
                    $"تم إصدار الفاتورة {det.Header.InvoiceNo} وتوليد قيدها المحاسبي آلياً.\n\nهل تريد طباعتها الآن؟",
                    "نجاح", MessageBoxButton.YesNo, MessageBoxImage.Information,
                    MessageBoxResult.No, MessageBoxOptions.RtlReading | MessageBoxOptions.RightAlign);
                if (ok == MessageBoxResult.Yes) PrintInvoice(det);

                _lines.Clear();
                LinesGrid.Items.Refresh();
                EmptyLines.Visibility = Visibility.Visible;
                DiscountBox.Text = "0"; TaxBox.Text = "0"; NotesBox.Text = "";
                CashRadio.IsChecked = true;
                PatientCombo.SelectedIndex = -1;
                _patient = null;
                PatientNameText.Text = "— لم يُحدَّد —";
                PatientInfoText.Text = "";
                RecalcTotals();
            }
            catch (BusinessRuleException ex) { ErrorText.Text = ex.Message; }
            catch (Exception ex) { ErrorText.Text = "خطأ: " + ex.Message; }
            finally { SaveBtn.IsEnabled = true; }
        }

        private void PrintInvoice(InvoiceDetail det)
        {
            try
            {
                var h = det.Header;
                var rows = det.Lines.Select(l => new[]
                { l.ServiceName, l.Qty.ToString(), l.UnitPrice.ToString("N2"), l.LineTotal.ToString("N2") });
                var footers = new[]
                {
                    $"الإجمالي: {h.GrossAmount:N2}",
                    $"الخصم: -{h.DiscountAmount:N2}",
                    $"الضريبة: {h.TaxAmount:N2}",
                    $"الصافي: {h.NetAmount:N2}",
                    h.PayerType == 2 ? $"حصة التأمين: {h.InsuranceShare:N2} | حصة المريض: {h.PatientShare:N2}" : "",
                    $"المدفوع: {h.PaidAmount:N2} | المتبقي: {h.Remaining:N2}"
                }.Where(f => f.Length > 0).ToArray();

                FlowPrinter.Print($"فاتورة {h.InvoiceNo}",
                    $"مريض: {h.PatientName} ({h.MRN}) | {h.PayerText} | {h.InvoiceDate.ToLocalTime():yyyy/MM/dd HH:mm}",
                    new[] { "الخدمة", "كمية", "سعر", "إجمالي" }, rows, footers);
            }
            catch (Exception ex) { Warn("فشل الطباعة: " + ex.Message); }
        }

        /* ===== الفواتير السابقة ===== */
        private async Task LoadInvoicesAsync()
        {
            try
            {
                int? st = null;
                if (InvStatus.SelectedItem is ComboBoxItem si && si.Tag is string tag && tag.Length > 0)
                    st = int.Parse(tag);

                var (items, total) = await _bilSvc.GetInvoicesAsync(_ctx,
                    InvFrom.SelectedDate, InvTo.SelectedDate, st, InvSearch.Text, _invPage, InvPageSize);
                _invTotal = total;
                InvGrid.ItemsSource = items;
                int pages = Math.Max(1, (int)Math.Ceiling(total / (double)InvPageSize));
                if (_invPage > pages) _invPage = pages;
                InvPageInfo.Text = $"صفحة {_invPage} من {pages} — الإجمالي: {total}";
                UpdateInvButtons();
            }
            catch (Exception ex) { Warn("خطأ: " + ex.Message); }
        }

        private void UpdateInvButtons()
        {
            if (!(InvGrid.SelectedItem is InvoiceListItem sel))
            { BtnView.IsEnabled = BtnPay.IsEnabled = BtnVoid.IsEnabled = BtnPrint.IsEnabled = false; return; }
            BtnView.IsEnabled = true;
            BtnPrint.IsEnabled = true;
            BtnPay.IsEnabled = sel.StatusText != "ملغاة" && sel.StatusText != "مسددة" && sel.Remaining > 0;
            BtnVoid.IsEnabled = sel.StatusText == "مؤكدة" && sel.PaidAmount == 0;
        }

        private void InvGrid_SelectionChanged(object s, SelectionChangedEventArgs e) => UpdateInvButtons();
        private async void ReloadInv_Click(object s, RoutedEventArgs e) { _invPage = 1; await LoadInvoicesAsync(); }
        private async void InvSearch_Click(object s, RoutedEventArgs e) { _invPage = 1; await LoadInvoicesAsync(); }
        private async void InvPrev_Click(object s, RoutedEventArgs e)
        { if (_invPage > 1) { _invPage--; await LoadInvoicesAsync(); } }
        private async void InvNext_Click(object s, RoutedEventArgs e)
        { if (_invPage * InvPageSize < _invTotal) { _invPage++; await LoadInvoicesAsync(); } }

        private async void View_Click(object sender, RoutedEventArgs e)
        {
            if (!(InvGrid.SelectedItem is InvoiceListItem sel)) return;
            try
            {
                var det = await _bilSvc.GetInvoiceDetailsAsync(_ctx, sel.InvoiceId);
                new Dialogs.InvoiceDetailWindow(det) { Owner = Window.GetWindow(this) }.ShowDialog();
            }
            catch (Exception ex) { Warn("خطأ: " + ex.Message); }
        }

        private async void Pay_Click(object sender, RoutedEventArgs e)
        {
            if (!(InvGrid.SelectedItem is InvoiceListItem sel)) return;
            var dlg = new Dialogs.PaymentWindow(sel.InvoiceNo, sel.Remaining) { Owner = Window.GetWindow(this) };
            if (dlg.ShowDialog() != true) return;
            try
            {
                await _bilSvc.RecordPaymentAsync(_ctx, sel.InvoiceId, dlg.Amount, dlg.Method);
                Info($"تم تسجيل دفع {dlg.Amount:N2} للفاتورة {sel.InvoiceNo}.\nأُنشئ قيد التحصيل آلياً.");
                await LoadInvoicesAsync();
            }
            catch (BusinessRuleException ex) { Warn(ex.Message); }
            catch (Exception ex) { Warn("خطأ: " + ex.Message); }
        }

        private async void Void_Click(object sender, RoutedEventArgs e)
        {
            if (!(InvGrid.SelectedItem is InvoiceListItem sel)) return;
            if (MessageBox.Show($"إلغاء الفاتورة {sel.InvoiceNo}؟\nسيتم عكس قيدها المحاسبي آلياً.",
                    "تأكيد الإلغاء", MessageBoxButton.YesNo, MessageBoxImage.Warning,
                    MessageBoxResult.No, MessageBoxOptions.RtlReading | MessageBoxOptions.RightAlign)
                != MessageBoxResult.Yes) return;

            var dlg = new Dialogs.SimpleInputWindow("إلغاء فاتورة", $"سبب إلغاء {sel.InvoiceNo}:")
            { Owner = Window.GetWindow(this) };
            if (dlg.ShowDialog() != true) return;
            try
            {
                await _bilSvc.VoidInvoiceAsync(_ctx, sel.InvoiceId, dlg.Value);
                Info($"تم إلغاء الفاتورة {sel.InvoiceNo} وعكس قيدها المحاسبي.");
                await LoadInvoicesAsync();
            }
            catch (BusinessRuleException ex) { Warn(ex.Message); }
            catch (Exception ex) { Warn("خطأ: " + ex.Message); }
        }

        private async void Print_Click(object sender, RoutedEventArgs e)
        {
            if (!(InvGrid.SelectedItem is InvoiceListItem sel)) return;
            try
            {
                var det = await _bilSvc.GetInvoiceDetailsAsync(_ctx, sel.InvoiceId);
                PrintInvoice(det);
            }
            catch (Exception ex) { Warn("خطأ: " + ex.Message); }
        }

        private static void Warn(string m) => MessageBox.Show(m, "تنبيه",
            MessageBoxButton.OK, MessageBoxImage.Warning, MessageBoxResult.OK,
            MessageBoxOptions.RtlReading | MessageBoxOptions.RightAlign);
        private static void Info(string m) => MessageBox.Show(m, "تم",
            MessageBoxButton.OK, MessageBoxImage.Information, MessageBoxResult.OK,
            MessageBoxOptions.RtlReading | MessageBoxOptions.RightAlign);
    }
}
```

### رقعة `BillingView.xaml` — أضف قائمة المرضى (كانت مفقودة من الواجهة)

في العمود الأيسر (لوحة الملخص)، **قبل** بطاقة "المريض"، أضف:

```xml
<TextBlock Text="المريض *" FontSize="12" Foreground="#64748B" Margin="0,0,0,4"/>
<ComboBox x:Name="PatientCombo" DisplayMemberPath="FullName" SelectedValuePath="PatientId"
          SelectionChanged="PatientCombo_Changed" Padding="6,6" Margin="0,0,0,10"/>
```

وغيّر نص `PatientNameText` الافتراضي إلى `— لم يُحدَّد —`.

---

## 6) `Pages/MigrationControl.xaml.cs` — (لم يُسلَّم قط)

```csharp
using System;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using MEAAF.Business;
using MEAAF.Core;

namespace MEAAF.UI.Pages
{
    public partial class MigrationControl : UserControl
    {
        private readonly MigrationService _svc;
        private readonly UserContext _ctx;

        public MigrationControl(MigrationService svc, UserContext ctx)
        {
            InitializeComponent();
            _svc = svc; _ctx = ctx;
            Loaded += async (s, e) => await LoadAsync();
        }

        private async Task LoadAsync()
        {
            try { ConnectionsGrid.ItemsSource = await _svc.GetConnectionsAsync(_ctx); }
            catch (UnauthorizedAccessException ua) { StatusText.Text = "🔒 " + ua.Message; }
            catch (Exception ex) { StatusText.Text = "خطأ: " + ex.Message; }
        }

        private async void AddSource_Click(object sender, RoutedEventArgs e)
        {
            var nameDlg = new Dialogs.SimpleInputWindow("اتصال مصدر جديد", "اسم الاتصال:")
            { Owner = Window.GetWindow(this) };
            if (nameDlg.ShowDialog() != true) return;

            var csDlg = new Dialogs.SimpleInputWindow("اتصال مصدر جديد",
                "سلسلة الاتصال (SQL Server):")
            { Owner = Window.GetWindow(this) };
            if (csDlg.ShowDialog() != true) return;

            try
            {
                await _svc.CreateConnectionAsync(_ctx, ConnectorType.SQLServer,
                    nameDlg.Value, csDlg.Value);
                StatusText.Text = "تم حفظ الاتصال. (تنبيه: تُخزَّن السلسلة نصاً حالياً — التشفير في مرحلة أمان لاحقة)";
                await LoadAsync();
            }
            catch (Exception ex) { StatusText.Text = "خطأ: " + ex.Message; }
        }

        private void Discover_Click(object sender, RoutedEventArgs e)
            => StatusText.Text = "BLOCKED: يتطلب ربط SqlServerConnector بالاتصال المحفوظ ومصدر بيانات حقيقي.";

        private void Reconcile_Click(object sender, RoutedEventArgs e)
            => StatusText.Text = "BLOCKED: المطابقة تتطلب ترحيلاً فعلياً منفَّذاً أولاً — لا توجد بيانات للمقارنة.";
    }
}
```

---

## 7) `MEAAF.Connectors/SqlServerConnector.cs` — النسخة المصححة

**الخطأ في النسخة القديمة:** تعريف `DiscoverSchemas()` مكرر (تجميع الكود كان سيفشل). هذه النسخة النهائية:

```csharp
using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SqlClient;
using MEAAF.Core;

namespace MEAAF.Connectors
{
    public sealed class SqlServerConnector : IConnector
    {
        private SqlConnection _conn;

        public bool Connect(string connectionString)
        {
            try { Disconnect(); _conn = new SqlConnection(connectionString); _conn.Open(); return true; }
            catch { _conn = null; return false; }
        }

        public bool TestConnection() => _conn != null && _conn.State == ConnectionState.Open;

        public List<string> DiscoverSchemas()
        {
            var list = new List<string>();
            if (!TestConnection()) return list;
            using (var cmd = new SqlCommand("SELECT name FROM sys.schemas ORDER BY name", _conn))
            using (var r = cmd.ExecuteReader())
                while (r.Read()) list.Add(r.GetString(0));
            return list;
        }

        public List<(string Schema, string Table, List<string> Columns)> DiscoverSchemaDetails(string tableOrQuery = null)
        {
            var result = new List<(string, string, List<string>)>();
            if (!TestConnection()) return result;

            string sql = "SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS";
            if (!string.IsNullOrWhiteSpace(tableOrQuery))
                sql += " WHERE TABLE_NAME = @t";
            sql += " ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION";

            using (var cmd = new SqlCommand(sql, _conn))
            {
                if (!string.IsNullOrWhiteSpace(tableOrQuery))
                    cmd.Parameters.AddWithValue("@t", tableOrQuery);
                using (var r = cmd.ExecuteReader())
                {
                    string cs = null, ct = null; List<string> cols = null;
                    while (r.Read())
                    {
                        string s = r.GetString(0), t = r.GetString(1);
                        if (cs != s || ct != t)
                        {
                            if (ct != null) result.Add((cs, ct, cols));
                            cs = s; ct = t; cols = new List<string>();
                        }
                        cols.Add(r.GetString(2));
                    }
                    if (ct != null) result.Add((cs, ct, cols));
                }
            }
            return result;
        }

        public (int Count, List<Dictionary<string, object>> Preview) PreviewTable(string tableOrQuery, int maxRows = 10)
        {
            var preview = new List<Dictionary<string, object>>();
            if (!TestConnection()) return (0, preview);
            using (var cmd = new SqlCommand("SELECT TOP (" + maxRows + ") * FROM [" + tableOrQuery + "]", _conn))
            using (var r = cmd.ExecuteReader())
                while (r.Read())
                {
                    var row = new Dictionary<string, object>();
                    for (int i = 0; i < r.FieldCount; i++)
                        row[r.GetName(i)] = r.IsDBNull(i) ? null : r.GetValue(i);
                    preview.Add(row);
                }
            return (preview.Count, preview);
        }

        public DataTable ReadTable(string tableOrQuery)
        {
            var dt = new DataTable();
            if (!TestConnection()) return dt;
            using (var a = new SqlDataAdapter("SELECT * FROM [" + tableOrQuery + "]", _conn))
                a.Fill(dt);
            return dt;
        }

        public long CountTable(string tableOrQuery)
        {
            if (!TestConnection()) return 0;
            using (var cmd = new SqlCommand("SELECT COUNT(*) FROM [" + tableOrQuery + "]", _conn))
                return (long)cmd.ExecuteScalar();
        }

        public void Disconnect() { _conn?.Close(); _conn?.Dispose(); _conn = null; }
        public void Dispose() => Disconnect();
    }
}
```

> **إعداد مشروع Connectors:**
> ```powershell
> dotnet new classlib -o src/MEAAF.Connectors -f net48
> dotnet sln add src/MEAAF.Connectors
> dotnet add src/MEAAF.Connectors reference src/MEAAF.Core/MEAAF.Core.csproj
> dotnet add src/MEAAF.UI reference src/MEAAF.Connectors/MEAAF.Connectors.csproj
> # + أضف <LangVersion>9.0</LangVersion> له أيضاً
> ```

---

## ✅ PHASE REPORT

```
PHASE               : CONSOLIDATION-1 — الملفات الناقصة + إصلاحات حرجة
STATUS              : DELIVERED — NOT VERIFIED
DELIVERED NOW       : PaymentWindow (كامل) | InvoiceDetailWindow (كامل) |
                      BillingView.xaml.cs النسخة الكاملة (كانت مقطوعة) |
                      MigrationControl.xaml.cs (لم يكن موجوداً) |
                      SqlServerConnector النسخة المُجمَّعة (تعريف مكرر أُصلح) |
                      رقعة PatientCombo في BillingView.xaml |
                      09_permissions_patch.sql (خطأ: Migration/Licensing كانت محجوبة عن الجميع)
BUGS FIXED          : SqlServerConnector duplicate method (compile-blocker)
                      Permissions gap for Migration/Licensing resources (runtime-blocker)
                      BillingView Void_Click truncation (compile-blocker)
REMAINING BATCHES   : B = Core + Data + Security (نسخ نهائية)
                      C = Business كاملة (9 خدمات)
                      D = UI الأساسية (App, MainWindow, Login, Setup, Helpers, Export)
                      E = Pages + Dialogs المتبقية + Tests + setup.ps1 + App.config + Runbook
NEXT                : اكتب "اكمل" لاستلام الدفعة B
```

**اكتب "اكمل" → تستلم الدفعة B (النواة: Core + Data + Security كاملة نهائية).**