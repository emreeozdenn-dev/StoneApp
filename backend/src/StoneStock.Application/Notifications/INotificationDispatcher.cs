namespace StoneStock.Application.Notifications;

public interface INotificationDispatcher
{
    void QueueNewStock(int incomingStockId);

    void QueueLowStock(int stoneId);

    void QueuePlateSold(int plateId);
}
