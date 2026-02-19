package action.process.bus;


interface ProcessBusInterface {

    void send(String command, String data);
}