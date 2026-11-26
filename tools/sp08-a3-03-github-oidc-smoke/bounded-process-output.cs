using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading.Tasks;

public static class BoundedProcessOutput
{
    public static async Task ReadAwaitReadyAsync(Stream stream)
    {
        byte[] expected = Encoding.ASCII.GetBytes("A303_AWAIT_SOURCE_READY\n");
        byte[] buffer = new byte[expected.Length];
        try
        {
            int offset = 0;
            while (offset < expected.Length)
            {
                int count = await stream.ReadAsync(buffer, offset, expected.Length - offset).ConfigureAwait(false);
                if (count == 0) throw new InvalidDataException("child-not-ready");
                offset += count;
            }
            for (int i = 0; i < expected.Length; i++)
                if (buffer[i] != expected[i]) throw new InvalidDataException("child-not-ready");
        }
        finally { Array.Clear(buffer, 0, buffer.Length); }
    }

    public static async Task<string> DrainAsync(Stream stream, int maxBytes, Process process)
    {
        byte[] buffer = new byte[1024];
        using (var output = new MemoryStream(Math.Min(maxBytes, 4096)))
        {
            try
            {
                while (true)
                {
                    int count = await stream.ReadAsync(buffer, 0, buffer.Length).ConfigureAwait(false);
                    if (count == 0) break;
                    if (output.Length + count > maxBytes)
                    {
                        try { if (!process.HasExited) process.Kill(); } catch { }
                        throw new InvalidDataException("child-output-limit");
                    }
                    output.Write(buffer, 0, count);
                }
                byte[] result = output.ToArray();
                try { return new UTF8Encoding(false, true).GetString(result); }
                finally { Array.Clear(result, 0, result.Length); }
            }
            finally { Array.Clear(buffer, 0, buffer.Length); }
        }
    }
}
