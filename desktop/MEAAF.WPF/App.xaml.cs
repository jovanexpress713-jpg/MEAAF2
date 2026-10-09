using System.Windows;
using System.Windows.Threading;

namespace MEAAF.WPF;

public partial class App : Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        DispatcherUnhandledException += OnDispatcherUnhandledException;
        base.OnStartup(e);
    }

    private static void OnDispatcherUnhandledException(object sender, DispatcherUnhandledExceptionEventArgs e)
    {
        MessageBox.Show(
            "حدث خطأ غير متوقع. يرجى إعادة المحاولة أو التواصل مع مسؤول النظام.",
            "منظومة مِعاف",
            MessageBoxButton.OK,
            MessageBoxImage.Error,
            MessageBoxResult.OK,
            MessageBoxOptions.RtlReading | MessageBoxOptions.RightAlign);
        e.Handled = true;
    }
}
