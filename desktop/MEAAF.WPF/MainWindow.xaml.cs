using System.Net.Http;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Threading;

namespace MEAAF.WPF;

public partial class MainWindow : Window
{
    private static readonly Brush ConnectedBrush = new SolidColorBrush(Color.FromRgb(22, 163, 74));
    private static readonly Brush DisconnectedBrush = new SolidColorBrush(Color.FromRgb(220, 38, 38));
    private static readonly Brush CheckingBrush = new SolidColorBrush(Color.FromRgb(156, 163, 175));

    private readonly HttpClient _httpClient;
    private readonly DispatcherTimer _connectionTimer;
    private readonly CancellationTokenSource _lifetimeCancellation = new();
    private bool _isCheckingConnection;

    public MainWindow()
    {
        InitializeComponent();

        _httpClient = new HttpClient
        {
            BaseAddress = ResolveApiBaseAddress(),
            Timeout = TimeSpan.FromSeconds(5)
        };
        _connectionTimer = new DispatcherTimer
        {
            Interval = TimeSpan.FromSeconds(30)
        };
        _connectionTimer.Tick += ConnectionTimer_Tick;
        Loaded += MainWindow_Loaded;
        Closed += MainWindow_Closed;
    }

    private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
    {
        _connectionTimer.Start();
        await CheckConnectionAsync();
    }

    private async void ConnectionTimer_Tick(object? sender, EventArgs e) => await CheckConnectionAsync();

    private async void RefreshConnection_Click(object sender, RoutedEventArgs e) => await CheckConnectionAsync();

    private async Task CheckConnectionAsync()
    {
        if (_isCheckingConnection)
        {
            return;
        }

        _isCheckingConnection = true;
        RefreshConnectionButton.IsEnabled = false;
        ConnectionIndicator.Fill = CheckingBrush;
        ConnectionStatusText.Text = "جارٍ فحص اتصال خدمة MEAAF...";

        try
        {
            using var response = await _httpClient.GetAsync("health", _lifetimeCancellation.Token);
            if (response.IsSuccessStatusCode)
            {
                ConnectionIndicator.Fill = ConnectedBrush;
                ConnectionStatusText.Text = $"الخدمة: متصلة | API: {_httpClient.BaseAddress} | قاعدة البيانات: MEAAF_DB";
            }
            else
            {
                ShowDisconnectedStatus($"استجابة HTTP {(int)response.StatusCode}");
            }
        }
        catch (OperationCanceledException) when (_lifetimeCancellation.IsCancellationRequested)
        {
            // The window is closing; no status update is needed.
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException)
        {
            ShowDisconnectedStatus("تعذر الوصول إلى خدمة .NET");
        }
        finally
        {
            _isCheckingConnection = false;
            RefreshConnectionButton.IsEnabled = true;
        }
    }

    private void ShowDisconnectedStatus(string reason)
    {
        ConnectionIndicator.Fill = DisconnectedBrush;
        ConnectionStatusText.Text = $"الخدمة: غير متصلة | {reason}";
    }

    private void ModuleAction_Click(object sender, RoutedEventArgs e)
    {
        var action = (sender as Button)?.Content?.ToString() ?? "الوحدة";
        MessageBox.Show(
            $"تم اختيار: {action}\nهذه النافذة هي الواجهة الرئيسية، وستُفتح شاشة الوحدة المتخصصة من هذا المسار عند إضافتها.",
            "منظومة مِعاف",
            MessageBoxButton.OK,
            MessageBoxImage.Information,
            MessageBoxResult.OK,
            MessageBoxOptions.RtlReading | MessageBoxOptions.RightAlign);
    }

    private void MainWindow_Closed(object? sender, EventArgs e)
    {
        _connectionTimer.Stop();
        _lifetimeCancellation.Cancel();
        _lifetimeCancellation.Dispose();
        _httpClient.Dispose();
    }

    private static Uri ResolveApiBaseAddress()
    {
        var configured = Environment.GetEnvironmentVariable("MEAAF_API_BASE_URL");
        if (Uri.TryCreate(configured, UriKind.Absolute, out var uri))
        {
            var normalized = uri.AbsoluteUri.EndsWith('/') ? uri.AbsoluteUri : $"{uri.AbsoluteUri}/";
            return new Uri(normalized, UriKind.Absolute);
        }

        return new Uri("http://localhost:5080/", UriKind.Absolute);
    }
}
